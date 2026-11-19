import { Injectable } from '@nestjs/common';
import { PasswordTokenPurpose, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PASSWORD_TOKEN_TTL_HOURS } from './auth.constants';
import { generateToken, hashToken } from './token.util';

/** Tokens de un solo uso para invitación y recuperación (HU-02/05). Solo se guarda el hash. */
@Injectable()
export class PasswordTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Invalida los tokens previos sin usar del mismo propósito y crea uno nuevo; devuelve el token en claro. */
  async issue(
    userId: string,
    purpose: PasswordTokenPurpose,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string> {
    const now = new Date();
    await db.passwordResetToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: now },
    });
    const token = generateToken();
    await db.passwordResetToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + PASSWORD_TOKEN_TTL_HOURS * 3_600_000),
      },
    });
    return token;
  }
}
