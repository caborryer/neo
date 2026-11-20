import { Outlet } from 'react-router-dom';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { NavLink } from 'react-router-dom';
import { BottomNavigation, userNavItems } from '@/components/layout/BottomNavigation';
import { userRoutes } from '@/app/routes';
import { cn } from '@/utils/cn';
import { LogoutButton } from '@/features/auth/LogoutButton';
import { MessagesLink } from '@/features/messages/MessagesLink';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { ConsentBanner } from '@/features/profile/ConsentBanner';

/** Layout de la usuaria: mobile-first, navegación inferior en móvil y superior en escritorio (§3.6). */
export function UserLayout() {
  return (
    <div className="min-h-dvh bg-neo-background pb-20 md:pb-0">
      <header className="sticky top-0 z-10 border-b border-neo-border bg-neo-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-8">
          <BrandLogo className="h-9" />
          <nav aria-label="Navegación de escritorio" className="hidden items-center gap-1 md:flex">
            {userNavItems
              .filter((i) => !i.disabled)
              .map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn('rounded-neo-button px-3 py-2 text-sm font-medium', isActive ? 'bg-neo-pink-light text-neo-primary-dark' : 'text-neo-dark hover:bg-neo-neutral')
                  }
                >
                  {label}
                </NavLink>
              ))}
          </nav>
          <div className="flex items-center gap-1">
            <MessagesLink to={userRoutes.messages} />
            <NotificationBell to={userRoutes.notifications} />
            <LogoutButton showLabel={false} className="px-2" />
          </div>
        </div>
      </header>
      <ConsentBanner />
      <main className="mx-auto max-w-5xl px-4 py-4 md:px-8 md:py-6">
        <Outlet />
      </main>
      <BottomNavigation />
    </div>
  );
}
