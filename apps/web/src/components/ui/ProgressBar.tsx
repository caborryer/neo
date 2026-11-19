import { cn } from '@/utils/cn';

export interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  className?: string;
}

export function ProgressBar({ value, max, label = 'Progreso', className }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-neo-green-light', className)}
    >
      <div className="h-full rounded-full bg-neo-green transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}
