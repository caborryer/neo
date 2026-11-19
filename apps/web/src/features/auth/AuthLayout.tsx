import type { ReactNode } from 'react';
import { AppCard } from '@/components/ui/AppCard';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-neo-background px-4 py-8">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-3xl font-bold text-neo-primary-dark">Neo</p>
        <AppCard className="md:p-8">
          <h1 className="text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neo-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </AppCard>
      </div>
    </main>
  );
}
