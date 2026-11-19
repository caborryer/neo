import { NavLink } from 'react-router-dom';
import { userRoutes } from '@/app/routes';
import { cn } from '@/utils/cn';

const TABS = [
  { to: userRoutes.nutritionPlan, label: 'Mi plan' },
  { to: userRoutes.nutritionDiary, label: 'Diario de alimentación' },
  { to: userRoutes.nutritionSchedules, label: 'Horarios' },
];

/** Pestañas de U05 (Mi plan · Diario · Horarios). */
export function NutritionTabs() {
  return (
    <nav aria-label="Secciones de nutrición" className="flex gap-1 overflow-x-auto">
      {TABS.map(({ to, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn('min-h-11 shrink-0 rounded-neo-button px-3 py-2.5 text-sm font-medium', isActive ? 'bg-neo-primary text-white' : 'bg-neo-neutral text-neo-dark hover:bg-neo-border')
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
