import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RiskSettingsDto } from '@neo/shared-types';
import { DEFAULT_RISK_SETTINGS, riskSettingsSchema, type RiskSettingsInput } from '@neo/validation';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

const RISK_KEY = 'risk';

/** HU-15: umbrales de las alertas, editables por la Coach. Si falta o está corrupto, rigen los valores por defecto. */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getRisk(): Promise<RiskSettingsDto> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: RISK_KEY } });
    const parsed = riskSettingsSchema.safeParse(row?.value ?? {});
    return parsed.success ? parsed.data : { ...DEFAULT_RISK_SETTINGS };
  }

  async updateRisk(actorId: string, input: RiskSettingsInput): Promise<RiskSettingsDto> {
    return this.prisma.$transaction(async (tx) => {
      const value = input as unknown as Prisma.InputJsonValue;
      await tx.appSetting.upsert({ where: { key: RISK_KEY }, create: { key: RISK_KEY, value }, update: { value } });
      await this.audit.record({ actorId, action: 'RISK_SETTINGS_UPDATED', resource: 'AppSetting', resourceId: RISK_KEY, metadata: value }, tx);
      return input;
    });
  }
}
