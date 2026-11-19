import { cn } from '@/utils/cn';

export interface SkeletonLoaderProps {
  lines?: number;
  className?: string;
}

export function SkeletonLoader({ lines = 3, className }: SkeletonLoaderProps) {
  return (
    <div role="status" aria-label="Cargando" className={cn('flex animate-pulse flex-col gap-3', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={cn('h-4 rounded bg-neo-neutral', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
