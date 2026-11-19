import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface AppCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function AppCard({ title, children, className }: AppCardProps) {
  return (
    <section className={cn('rounded-neo-card border border-neo-border bg-neo-surface p-4 shadow-neo-card md:p-6', className)}>
      {title && <h3 className="mb-3 text-base font-semibold text-neo-dark">{title}</h3>}
      {children}
    </section>
  );
}
