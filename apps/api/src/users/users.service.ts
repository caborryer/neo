import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PasswordTokenPurpose, Prisma, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import type { ApiList } from '@neo/shared-types';
import type { CreateUserInput, ListUsersQuery, UpdateProfileInput, UpdateUserInput } from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import { PasswordTokenService } from '../auth/password-token.service';
import { generateToken } from '../auth/token.util';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';

/** Columnas por las que se puede ordenar el listado (lista blanca: nunca se interpola input). */
const SORTABLE = ['firstName', 'lastName', 'email', 'status', 'createdAt', 'accessExpiresAt'] as const;
type Sortable = (typeof SORTABLE)[number];

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  timezone: true,
  weeklyGoal: true,
  accessExpiresAt: true,
  activatedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type UserSummary = Prisma.UserGetPayload<{ select: typeof userSelect }>;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwordTokens: PasswordTokenService,
    private readonly mail: MailService,
  ) {}

  /** HU-05: crea la usuaria en estado Pendiente y le envía la invitación. */
  async create(actorId: string, input: CreateUserInput): Promise<{ user: UserSummary; invitationSent: boolean }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new ConflictException('Ya existe una usuaria con ese correo');

    let created: { user: UserSummary; token: string };
    try {
      created = await this.prisma.$transaction(async (tx) => {
        // Contraseña inutilizable hasta que la usuaria defina la suya con el enlace de invitación.
        const passwordHash = await argon2.hash(generateToken(), { type: argon2.argon2id });
        const user = await tx.user.create({
          data: {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            timezone: input.timezone,
            accessExpiresAt: input.accessExpiresAt ?? null,
            passwordHash,
            role: UserRole.USER,
            status: UserStatus.PENDING,
            coachId: actorId,
          },
          select: userSelect,
        });
        await tx.userAccessEvent.create({
          data: { userId: user.id, changedById: actorId, previousStatus: null, newStatus: UserStatus.PENDING, reason: 'Alta de usuaria' },
        });
        await this.audit.record({ actorId, action: 'USER_CREATED', resource: 'User', resourceId: user.id }, tx);
        const token = await this.passwordTokens.issue(user.id, PasswordTokenPurpose.INVITATION, tx);
        return { user, token };
      });
    } catch (err) {
      // Carrera: otro request creó el mismo correo entre la comprobación y el insert.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Ya existe una usuaria con ese correo');
      }
      throw err;
    }

    // El correo se envía tras confirmar la transacción; si falla, la Coach puede reenviarlo.
    const invitationSent = await this.mail.sendInvitation(created.user.email, created.user.firstName, created.token);
    return { user: created.user, invitationSent };
  }

  async list(query: ListUsersQuery): Promise<ApiList<UserSummary>> {
    const where: Prisma.UserWhereInput = { role: UserRole.USER };
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const sortBy: Sortable = (SORTABLE as readonly string[]).includes(query.sortBy ?? '')
      ? (query.sortBy as Sortable)
      : 'createdAt';

    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ [sortBy]: query.sortOrder }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      data,
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
    };
  }

  async get(id: string): Promise<UserSummary> {
    const user = await this.prisma.user.findFirst({ where: { id, role: UserRole.USER }, select: userSelect });
    if (!user) throw new NotFoundException('Usuaria no encontrada');
    return user;
  }

  async update(actorId: string, id: string, input: UpdateUserInput): Promise<UserSummary> {
    await this.get(id);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: input, select: userSelect });
      await this.audit.record(
        { actorId, action: 'USER_UPDATED', resource: 'User', resourceId: id, metadata: { fields: Object.keys(input) } },
        tx,
      );
      return user;
    });
  }

  /** Reenvía la invitación mientras la usuaria siga Pendiente (Suposición: no está en §8). */
  async resendInvitation(actorId: string, id: string): Promise<{ invitationSent: boolean }> {
    const user = await this.get(id);
    if (user.status !== UserStatus.PENDING) {
      throw new ConflictException('Solo se puede reenviar la invitación a usuarias pendientes');
    }
    const token = await this.passwordTokens.issue(id, PasswordTokenPurpose.INVITATION);
    await this.audit.record({ actorId, action: 'INVITATION_RESENT', resource: 'User', resourceId: id });
    return { invitationSent: await this.mail.sendInvitation(user.email, user.firstName, token) };
  }

  /** HU-24: perfil propio (nombre, apellido, zona horaria y foto). La foto debe ser una imagen subida por ella misma. */
  async updateProfile(userId: string, input: UpdateProfileInput) {
    if (input.avatarAssetId) {
      const asset = await this.prisma.mediaAsset.findFirst({ where: { id: input.avatarAssetId, ownerId: userId }, select: { mimeType: true } });
      if (!asset || !asset.mimeType.startsWith('image/')) throw new BadRequestException('La foto de perfil no es válida');
    }
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data: input });
      await this.audit.record({ actorId: userId, action: 'PROFILE_UPDATED', resource: 'User', resourceId: userId, metadata: { fields: Object.keys(input) } }, tx);
      return user;
    });
  }

  /**
   * HU-28: la usuaria acepta la política de privacidad y el uso de fotos. Es idempotente: conserva
   * la fecha de la primera aceptación. Sin ella no puede subir imágenes.
   */
  async acceptPrivacy(userId: string) {
    const current = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (current.privacyConsentAt) return current;
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id: userId }, data: { privacyConsentAt: new Date() } });
      await this.audit.record({ actorId: userId, action: 'PRIVACY_CONSENT_ACCEPTED', resource: 'User', resourceId: userId }, tx);
      return user;
    });
  }
}
