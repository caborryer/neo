import { ForbiddenException, Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PasswordTokenPurpose, User, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { LoginAttemptLimiter } from './login-attempt-limiter';
import { hasActiveAccess } from './access.util';
import { UNAVAILABLE_ACCESS_MESSAGE } from './auth.constants';
import { PasswordTokenService } from './password-token.service';
import { generateToken, hashToken } from './token.util';

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
}

export interface ClientInfo {
  userAgent?: string;
  ip?: string;
}

const INVALID_CREDENTIALS = 'Credenciales inválidas';
const INVALID_LINK = 'El enlace es inválido o ya expiró';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash de relleno: se verifica igual cuando el correo no existe, para no filtrar su existencia por tiempo de respuesta. */
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    private readonly passwordTokens: PasswordTokenService,
    private readonly loginLimiter: LoginAttemptLimiter = new LoginAttemptLimiter(),
  ) {}

  async login(email: string, password: string, client: ClientInfo): Promise<{ user: User; tokens: SessionTokens }> {
    const key = email.trim().toLowerCase();
    this.loginLimiter.assertAllowed(key);
    const user = await this.prisma.user.findUnique({ where: { email: key } });
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const valid = await argon2.verify(hash, password).catch(() => false);
    if (!user || !valid) {
      this.loginLimiter.recordFailure(key);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    this.loginLimiter.recordSuccess(key);

    // Solo tras validar la contraseña se revela que el acceso no está disponible (HU-01).
    if (!hasActiveAccess(user)) throw new ForbiddenException(UNAVAILABLE_ACCESS_MESSAGE);

    const tokens = await this.createSession(user, client);
    return { user, tokens };
  }

  /** Rotación del refresh token con detección de reutilización (§10.1). */
  async refresh(refreshToken: string | undefined, client: ClientInfo): Promise<{ user: User; tokens: SessionTokens }> {
    if (!refreshToken) throw new UnauthorizedException('Sesión no iniciada');
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException('Sesión inválida');

    if (session.revokedAt) {
      // Un token ya rotado se volvió a usar: posible robo. Se cierran todas las sesiones de la usuaria.
      await this.revokeAllSessions(session.userId);
      this.logger.warn(`Reutilización de refresh token detectada (usuaria ${session.userId})`);
      throw new UnauthorizedException('Sesión inválida');
    }
    if (session.expiresAt.getTime() <= Date.now()) throw new UnauthorizedException('Sesión expirada');
    if (!hasActiveAccess(session.user)) {
      await this.revokeAllSessions(session.userId);
      throw new ForbiddenException(UNAVAILABLE_ACCESS_MESSAGE);
    }

    const tokens = await this.createSession(session.user, client, session.id);
    return { user: session.user, tokens };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** HU-02: respuesta siempre igual, exista o no el correo. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.status === UserStatus.PENDING) return;
    const token = await this.passwordTokens.issue(user.id, PasswordTokenPurpose.RESET);
    await this.mail.sendPasswordReset(user.email, user.firstName, token);
  }

  /** HU-02: define la contraseña con un token de invitación o de recuperación. */
  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(INVALID_LINK);
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const { user } = record;
    // Aceptar la invitación activa la cuenta (Suposición: se confirma con la Coach).
    const activates = record.purpose === PasswordTokenPurpose.INVITATION && user.status === UserStatus.PENDING;

    await this.prisma.$transaction(async (tx) => {
      // updateMany con usedAt:null evita que dos solicitudes simultáneas usen el mismo token.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (claimed.count === 0) throw new BadRequestException(INVALID_LINK);

      await tx.user.update({
        where: { id: user.id },
        data: activates ? { passwordHash, status: UserStatus.ACTIVE, activatedAt: new Date() } : { passwordHash },
      });
      if (activates) {
        await tx.userAccessEvent.create({
          data: {
            userId: user.id,
            changedById: user.id,
            previousStatus: UserStatus.PENDING,
            newStatus: UserStatus.ACTIVE,
            reason: 'Invitación aceptada',
          },
        });
      }
      await tx.refreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          actorId: user.id,
          action: activates ? 'INVITATION_ACCEPTED' : 'PASSWORD_RESET',
          resource: 'User',
          resourceId: user.id,
        },
        tx,
      );
    });
  }

  /**
   * HU-24: cambio de contraseña con la actual. Cierra las demás sesiones y conserva la del dispositivo
   * desde el que se hace el cambio (`keepRefreshToken`).
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string, keepRefreshToken?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword).catch(() => false))) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshSession.updateMany({
        where: { userId, revokedAt: null, ...(keepRefreshToken ? { tokenHash: { not: hashToken(keepRefreshToken) } } : {}) },
        data: { revokedAt: new Date() },
      });
      await this.audit.record({ actorId: userId, action: 'PASSWORD_CHANGED', resource: 'User', resourceId: userId }, tx);
    });
  }

  private async createSession(user: User, client: ClientInfo, replacesSessionId?: string): Promise<SessionTokens> {
    const accessMaxAgeMs = (this.config.get<number>('ACCESS_TOKEN_TTL_MINUTES') ?? 15) * 60_000;
    const refreshMaxAgeMs = (this.config.get<number>('REFRESH_TOKEN_TTL_DAYS') ?? 14) * 86_400_000;
    const refreshToken = generateToken();

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshSession.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + refreshMaxAgeMs),
          userAgent: client.userAgent?.slice(0, 255),
          ipAddress: client.ip,
        },
      });
      if (replacesSessionId) {
        await tx.refreshSession.update({
          where: { id: replacesSessionId },
          data: { revokedAt: new Date(), replacedById: created.id },
        });
      }
    });

    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        algorithm: 'HS256',
        expiresIn: Math.floor(accessMaxAgeMs / 1000),
      },
    );
    return { accessToken, refreshToken, accessMaxAgeMs, refreshMaxAgeMs };
  }

  private revokeAllSessions(userId: string) {
    return this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash('neo-dummy-password', { type: argon2.argon2id });
    return this.dummyHash;
  }
}
