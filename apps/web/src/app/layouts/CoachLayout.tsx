import { useState } from 'react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { LogoutButton } from '@/features/auth/LogoutButton';
import { MessagesLink } from '@/features/messages/MessagesLink';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { coachRoutes } from '@/app/routes';

/** Layout de la Coach: desktop-first; sidebar en escritorio, colapsada en tablet y drawer en móvil (§3.6). */
export function CoachLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-neo-background lg:flex">
      <aside className="sticky top-0 hidden h-dvh border-r border-neo-border bg-neo-surface md:block md:w-16 lg:w-64">
        <div className="px-4 py-4 md:hidden lg:block"><BrandLogo className="h-12" /></div>
        <div className="md:hidden lg:block"><Sidebar /></div>
        <div className="hidden md:block lg:hidden"><Sidebar collapsed /></div>
        <div className="p-3 md:hidden lg:block"><LogoutButton className="w-full" /></div>
        <div className="hidden p-3 md:block lg:hidden"><LogoutButton showLabel={false} className="w-full justify-center" /></div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center gap-3 border-b border-neo-border bg-neo-surface px-4 py-3 md:hidden">
          <button
            type="button"
            aria-label="Abrir menú"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="rounded-neo-button p-2 hover:bg-neo-neutral"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <BrandLogo className="h-9" />
          <div className="ml-auto flex items-center"><MessagesLink to={coachRoutes.messages} /><NotificationBell to={coachRoutes.notifications} /></div>
        </header>

        {drawerOpen && (
          <div className="fixed inset-0 z-30 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
            <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 bg-neo-surface shadow-neo-card">
              <div className="flex items-center justify-between px-4 py-3">
                <BrandLogo className="h-9" />
                <button type="button" aria-label="Cerrar menú" onClick={() => setDrawerOpen(false)} className="rounded-neo-button p-2 hover:bg-neo-neutral">
                  <X className="size-5" aria-hidden="true" />
                </button>
              </div>
              <Sidebar onNavigate={() => setDrawerOpen(false)} />
              <div className="p-3"><LogoutButton className="w-full" /></div>
            </div>
          </div>
        )}

        <div className="hidden items-center justify-end border-b border-neo-border bg-neo-surface px-6 py-2 md:flex">
          <MessagesLink to={coachRoutes.messages} />
          <NotificationBell to={coachRoutes.notifications} />
        </div>

        <main className="px-4 py-4 md:px-6 md:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
