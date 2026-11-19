import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  neutral: 'bg-neo-neutral text-neo-dark',
  success: 'bg-neo-green-light text-neo-green',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-neo-pink-light text-neo-primary-dark',
};

export interface AppBadgeProps {
  tone?: Tone;
  /** Icono opcional: los estados nunca dependen solo del color (§3.2). */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppBadge({ tone = 'neutral', icon, children, className }: AppBadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
