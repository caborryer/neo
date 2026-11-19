import { NavLink } from 'react-router-dom';
import {
  BookOpen, Camera, CalendarDays, ChartColumn, Dumbbell, House, MessageCircle, Settings, Trophy, UserRound, Utensils,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { coachRoutes } from '@/app/routes';

interface Item {
  to: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

/** Navegación del panel Coach (§2.2). Estadísticas y Mensajes son posteriores al MVP. */
export const coachNavItems: Item[] = [
  { to: coachRoutes.dashboard, label: 'Dashboard', icon: House },
  { to: coachRoutes.users, label: 'Usuarias', icon: UserRound },
  { to: coachRoutes.calendar, label: 'Calendario', icon: CalendarDays },
  { to: coachRoutes.workouts, label: 'Entrenamientos', icon: Dumbbell },
  { to: coachRoutes.nutritionPlans, label: 'Planes nutricionales', icon: Utensils },
  { to: coachRoutes.foodReviews, label: 'Revisión alimenticia', icon: Camera },
  { to: coachRoutes.content, label: 'Contenido', icon: BookOpen },
  { to: coachRoutes.challenges, label: 'Retos', icon: Trophy },
  { to: coachRoutes.statistics, label: 'Estadísticas', icon: ChartColumn, disabled: true },
  { to: coachRoutes.messages, label: 'Mensajes', icon: MessageCircle, disabled: true },
  { to: coachRoutes.settings, label: 'Configuración', icon: Settings },
];

export interface SidebarProps {
  /** En tablet se muestra colapsado (solo iconos). */
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Navegación del panel" className="flex flex-col gap-1 p-3">
      {coachNavItems.map(({ to, label, icon: Icon, disabled }) =>
        disabled ? (
          <span
            key={to}
            aria-disabled="true"
            title="Próximamente"
            className="flex min-h-11 items-center gap-3 rounded-neo-button px-3 text-sm text-neo-muted opacity-50"
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className={cn(collapsed && 'sr-only')}>{label}</span>
          </span>
        ) : (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-neo-button px-3 text-sm font-medium',
                isActive ? 'bg-neo-pink-light text-neo-primary-dark' : 'text-neo-dark hover:bg-neo-neutral',
              )
            }
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className={cn(collapsed && 'sr-only')}>{label}</span>
          </NavLink>
        ),
      )}
    </nav>
  );
}
