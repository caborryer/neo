import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  /** Sin contraseñas, tokens ni datos sensibles innecesarios (§7.10). */
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recibe el cliente de la transacción para que el registro quede atómico con el cambio. */
  record(entry: AuditEntry, db: Db = this.prisma) {
    return db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        metadata: entry.metadata,
      },
    });
  }
}
