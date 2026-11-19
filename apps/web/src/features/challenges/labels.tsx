import { CheckCircle2, CircleDashed, Clock, Flag, XCircle } from 'lucide-react';
import type { ChallengeParticipantStatus, ChallengePhase } from '@neo/shared-types';
import { AppBadge } from '@/components/ui/AppBadge';

export const fmtDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtRange = (start: string, end: string) => `${fmtDay(start)} – ${fmtDay(end)}`;

const PHASE: Record<ChallengePhase, { label: string; tone: 'info' | 'success' | 'neutral'; icon: typeof Clock }> = {
  UPCOMING: { label: 'Próximamente', tone: 'info', icon: Clock },
  ACTIVE: { label: 'En curso', tone: 'success', icon: Flag },
  ENDED: { label: 'Terminado', tone: 'neutral', icon: XCircle },
};

/** Texto + icono: el estado nunca depende solo del color (§3.2). */
export function PhaseBadge({ phase }: { phase: ChallengePhase }) {
  const v = PHASE[phase];
  const Icon = v.icon;
  return <AppBadge tone={v.tone} icon={<Icon className="size-3" aria-hidden="true" />}>{v.label}</AppBadge>;
}

const STATUS: Record<ChallengeParticipantStatus, { label: string; tone: 'info' | 'success' | 'neutral'; icon: typeof Clock }> = {
  IN_PROGRESS: { label: 'En progreso', tone: 'info', icon: CircleDashed },
  COMPLETED: { label: 'Completado', tone: 'success', icon: CheckCircle2 },
  ABANDONED: { label: 'Abandonado', tone: 'neutral', icon: XCircle },
};

export function ParticipationBadge({ status }: { status: ChallengeParticipantStatus }) {
  const v = STATUS[status];
  const Icon = v.icon;
  return <AppBadge tone={v.tone} icon={<Icon className="size-3" aria-hidden="true" />}>{v.label}</AppBadge>;
}
