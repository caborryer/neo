import { NavLink } from 'react-router-dom';
import { Dumbbell, House, Trophy, UserRound, Utensils, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { userRoutes } from '@/app/routes';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Los módulos posteriores al MVP se muestran deshabilitados (Suposición HU-04). */
  disabled?: boolean;
}

/** Navegación inferior de la usuaria (§2.1, U01). Iconos según §3.7. */
export const userNavItems: Item[] = [
  { to: userRoutes.dashboard, label: 'Inicio', icon: House },
  { to: userRoutes.workouts, label: 'Entrenamientos', icon: Dumbbell },
  { to: userRoutes.nutrition, label: 'Nutrición', icon: Utensils },
  { to: userRoutes.challenges, label: 'Retos', icon: Trophy },
  { to: userRoutes.profile, label: 'Perfil', icon: UserRound },
];

export function BottomNavigation() {
  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-neo-border bg-neo-surface md:hidden">
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {userNavItems.map(({ to, label, icon: Icon, disabled }) => (
          <li key={to} className="flex-1">
            {disabled ? (
              <span
                aria-disabled="true"
                title="Próximamente"
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-neo-muted opacity-50"
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </span>
            ) : (
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                    isActive ? 'text-neo-primary-dark' : 'text-neo-muted',
                  )
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </NavLink>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
