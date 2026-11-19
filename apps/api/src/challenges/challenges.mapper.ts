import type { Challenge, ChallengeParticipant } from '@prisma/client';
import type { ChallengeDto, ChallengePhase } from '@neo/shared-types';
import { formatDateOnly, todayIn } from '../common/dates';

export function phaseOf(c: Pick<Challenge, 'startDate' | 'endDate'>, timeZone: string, now: Date = new Date()): ChallengePhase {
  const today = todayIn(timeZone, now);
  if (formatDateOnly(c.startDate) > today) return 'UPCOMING';
  if (formatDateOnly(c.endDate) < today) return 'ENDED';
  return 'ACTIVE';
}

export function toChallengeDto(
  c: Challenge,
  opts: { timeZone: string; participantCount: number; mine?: ChallengeParticipant | null },
): ChallengeDto {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    category: c.category,
    goal: c.goal,
    goalUnit: c.goalUnit as ChallengeDto['goalUnit'],
    startDate: formatDateOnly(c.startDate),
    endDate: formatDateOnly(c.endDate),
    published: c.isActive,
    phase: phaseOf(c, opts.timeZone),
    participantCount: opts.participantCount,
    createdAt: c.createdAt.toISOString(),
    my: opts.mine
      ? { status: opts.mine.status as NonNullable<ChallengeDto['my']>['status'], progress: opts.mine.progress, joinedAt: opts.mine.joinedAt.toISOString() }
      : null,
  };
}
