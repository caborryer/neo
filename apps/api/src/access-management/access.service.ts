import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import type { ApiList } from '@neo/shared-types';
import type { ChangeAccessInput, PaginationQuery } from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/** Transiciones válidas (HU-06/07). Un cambio al mismo estado no es una transición. */
export const ALLOWED_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  PENDING: [UserStatus.ACTIVE, UserStatus.INACTIVE],
  ACTIVE: [UserStatus.SUSPENDED, UserStatus.INACTIVE],
  SUSPENDED: [UserStatus.ACTIVE, UserStatus.INACTIVE],
  INACTIVE: [UserStatus.ACTIVE],
};

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Cambia el estado de acceso. El cambio de estado, el UserAccessEvent y el AuditLog se
   * escriben en la MISMA transacción (§7.1, HU-28): o quedan los tres o ninguno.
   */
  async changeAccess(actorId: string, userId: string, input: ChangeAccessInput) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({ where: { id: userId, role: UserRole.USER } });
      if (!user) throw new NotFoundException('Usuaria no encontrada');

      const sameStatus = user.status === input.status;
      const expiryChanged =
        input.accessExpiresAt !== undefined &&
        (input.accessExpiresAt?.getTime() ?? null) !== (user.accessExpiresAt?.getTime() ?? null);

      if (sameStatus && !expiryChanged) {
        throw new BadRequestException('La usuaria ya tiene ese estado de acceso');
      }
      if (!sameStatus && !ALLOWED_TRANSITIONS[user.status].includes(input.status)) {
        throw new BadRequestException(`No se puede pasar de ${user.status} a ${input.status}`);
      }
      if (input.status === UserStatus.ACTIVE && input.accessExpiresAt && input.accessExpiresAt.getTime() <= Date.now()) {
        throw new BadRequestException('La fecha de expiración debe ser futura');
      }

      const data: Prisma.UserUpdateInput = { status: input.status };
      if (input.accessExpiresAt !== undefined) data.accessExpiresAt = input.accessExpiresAt;
      if (input.status === UserStatus.ACTIVE && !user.activatedAt) data.activatedAt = new Date();

      const updated = await tx.user.update({
        where: { id: userId },
        data,
        select: { id: true, status: true, accessExpiresAt: true, activatedAt: true },
      });

      await tx.userAccessEvent.create({
        data: {
          userId,
          changedById: actorId,
          previousStatus: user.status,
          newStatus: input.status,
          reason: input.reason || null,
        },
      });

      // Suspender o inactivar cierra las sesiones: el efecto es inmediato (HU-06/07).
      if (input.status === UserStatus.SUSPENDED || input.status === UserStatus.INACTIVE) {
        await tx.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }

      await this.audit.record(
        {
          actorId,
          action: 'USER_ACCESS_CHANGED',
          resource: 'User',
          resourceId: userId,
          metadata: {
            from: user.status,
            to: input.status,
            reason: input.reason ?? null,
            accessExpiresAt: updated.accessExpiresAt ? updated.accessExpiresAt.toISOString() : null,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async history(userId: string, query: Pick<PaginationQuery, 'page' | 'limit'>): Promise<ApiList<unknown>> {
    const exists = await this.prisma.user.findFirst({ where: { id: userId, role: UserRole.USER }, select: { id: true } });
    if (!exists) throw new NotFoundException('Usuaria no encontrada');

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.userAccessEvent.count({ where: { userId } }),
      this.prisma.userAccessEvent.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { changedBy: { select: { firstName: true, lastName: true } } },
      }),
    ]);
    const data = rows.map((e) => ({
      id: e.id,
      previousStatus: e.previousStatus,
      newStatus: e.newStatus,
      reason: e.reason,
      changedBy: `${e.changedBy.firstName} ${e.changedBy.lastName}`,
      createdAt: e.createdAt.toISOString(),
    }));
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
  }
}
