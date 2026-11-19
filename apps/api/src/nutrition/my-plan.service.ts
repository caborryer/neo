import { Injectable } from '@nestjs/common';
import type { MyPlanResponse, NutritionPlanAssignmentDto } from '@neo/shared-types';
import { parseDateOnly, todayIn, formatDateOnly } from '../common/dates';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../database/prisma.service';
import { assignmentInclude, toAssignmentDto, toDaysDto, versionTreeInclude } from './nutrition.mapper';

/** HU-21: la usuaria consulta su plan en solo lectura. Solo ve sus propias asignaciones (RNF-19). */
@Injectable()
export class MyPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async current(user: AuthenticatedUser, date?: string): Promise<MyPlanResponse> {
    const today = todayIn(user.timezone);
    const day = parseDateOnly(date ?? today);

    const assignment = await this.prisma.nutritionPlanAssignment.findFirst({
      where: { userId: user.id, status: 'ACTIVE', startDate: { lte: day }, OR: [{ endDate: null }, { endDate: { gte: day } }] },
      orderBy: { startDate: 'desc' },
      include: { version: { include: { ...versionTreeInclude, plan: { select: { name: true, description: true } } } } },
    });
    const upcoming = await this.prisma.nutritionPlanAssignment.findFirst({
      where: { userId: user.id, status: 'ACTIVE', startDate: { gt: parseDateOnly(today) } },
      orderBy: { startDate: 'asc' },
      include: { version: { select: { plan: { select: { name: true } } } } },
    });

    return {
      current: assignment && {
        assignmentId: assignment.id,
        planName: assignment.version.plan.name,
        planDescription: assignment.version.plan.description,
        versionNumber: assignment.version.versionNumber,
        notes: assignment.version.notes,
        startDate: formatDateOnly(assignment.startDate),
        endDate: assignment.endDate ? formatDateOnly(assignment.endDate) : null,
        days: toDaysDto(assignment.version.days),
      },
      upcoming: upcoming && { planName: upcoming.version.plan.name, startDate: formatDateOnly(upcoming.startDate) },
    };
  }

  async history(user: AuthenticatedUser): Promise<NutritionPlanAssignmentDto[]> {
    const today = todayIn(user.timezone);
    const rows = await this.prisma.nutritionPlanAssignment.findMany({
      where: { userId: user.id },
      include: assignmentInclude,
      orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
      take: 100,
    });
    return rows.map((r) => toAssignmentDto(r, today));
  }
}
