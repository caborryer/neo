import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Acción recomendada (§4.10). */
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-neo-card border border-dashed border-neo-border bg-neo-surface p-8 text-center">
      {icon && <div className="text-neo-muted">{icon}</div>}
      <h3 className="text-base font-semibold text-neo-dark">{title}</h3>
      {description && <p className="max-w-sm text-sm text-neo-muted">{description}</p>}
      {action}
    </div>
  );
}
