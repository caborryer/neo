import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { MealLogStatus, MealType, type MealLogDto, type NutritionMealDto } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useSession } from '@/features/auth/SessionProvider';
import { NutritionTabs } from '@/features/nutrition/NutritionTabs';
import { DAY_SHORT, MEAL_TYPE_LABEL, MEAL_TYPE_ORDER, MealLogStatusBadge, dayOfWeekOf } from '@/features/nutrition/labels';
import { mealLogsApi, myPlanApi } from '@/features/nutrition/nutritionApi';
import { ApiError } from '@/services/apiClient';
import { addDaysKey, dayLabel, fromDateKey, todayInZone, weekStartKey } from '@/utils/calendar';
import { cn } from '@/utils/cn';
import { MealLogModal } from './MealLogModal';

const EDITABLE = [MealLogStatus.DRAFT, MealLogStatus.NEEDS_CHANGES];

type Editing = { mealType: MealType; planned: NutritionMealDto | null; log: MealLogDto | null };

/** HU-22 · U06: diario de alimentación por día, con calendario semanal y tarjetas por comida. */
export function DiaryPage() {
  const { user } = useSession();
  // Sin la zona horaria de la usuaria no se sabe qué día es "hoy": se espera a la sesión.
  if (!user) return <AppCard><SkeletonLoader lines={6} /></AppCard>;
  return <DiaryPageInner timezone={user.timezone} />;
}

function DiaryPageInner({ timezone }: { timezone: string }) {
  const today = todayInZone(timezone);
  const [date, setDate] = useState(today);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const weekStart = weekStartKey(date);
  const week = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  const logs = useQuery({ queryKey: ['meal-logs', weekStart], queryFn: () => mealLogsApi.listMine(week[0]!, week[6]!) });
  // El plan vigente en esa fecha: da el contexto de qué estaba previsto comer.
  const plan = useQuery({ queryKey: ['my-plan', date], queryFn: () => myPlanApi.current(date) });

  const afterChange = () => queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
  const onActionError = (e: unknown) => setActionError(e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos completar la acción.');
  const send = useMutation({ mutationFn: (id: string) => mealLogsApi.submit(id), onSuccess: afterChange, onError: onActionError });
  const remove = useMutation({ mutationFn: (id: string) => mealLogsApi.remove(id), onSuccess: afterChange, onError: onActionError });

  const dayLogs = (logs.data ?? []).filter((l) => l.date === date);
  const daysWithLogs = new Set((logs.data ?? []).map((l) => l.date));
  const planDay = plan.data?.current?.days.find((d) => d.dayName === dayOfWeekOf(date));
  const plannedFor = (type: MealType) => planDay?.meals.find((m) => m.mealType === type) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <h1>Nutrición</h1>
      <NutritionTabs />

      <AppCard>
        <div className="flex items-center justify-between gap-2">
          <AppButton variant="secondary" aria-label="Semana anterior" onClick={() => setDate(addDaysKey(date, -7))}>
            <ChevronLeft className="size-4" aria-hidden="true" />
          </AppButton>
          <input
            type="date"
            aria-label="Elegir fecha"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm"
          />
          <AppButton variant="secondary" aria-label="Semana siguiente" disabled={addDaysKey(weekStart, 7) > today} onClick={() => setDate(addDaysKey(date, 7) > today ? today : addDaysKey(date, 7))}>
            <ChevronRight className="size-4" aria-hidden="true" />
          </AppButton>
        </div>
        <div role="group" aria-label="Días de la semana" className="mt-3 grid grid-cols-7 gap-1">
          {week.map((d) => {
            const future = d > today;
            return (
              <button
                key={d}
                type="button"
                disabled={future}
                aria-pressed={d === date}
                aria-label={`${dayLabel(d)}${daysWithLogs.has(d) ? ', con registros' : ''}`}
                onClick={() => setDate(d)}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-neo-input text-sm',
                  d === date ? 'bg-neo-primary text-white' : 'bg-neo-neutral hover:bg-neo-border',
                  future && 'cursor-not-allowed opacity-40',
                )}
              >
                <span className="text-xs">{DAY_SHORT[dayOfWeekOf(d)]}</span>
                <span className="font-semibold">{fromDateKey(d).getDate()}</span>
                <span aria-hidden="true" className={cn('mt-0.5 size-1.5 rounded-full', daysWithLogs.has(d) ? (d === date ? 'bg-white' : 'bg-neo-primary') : 'bg-transparent')} />
              </button>
            );
          })}
        </div>
      </AppCard>

      <h2 className="text-lg">{dayLabel(date)}{date === today ? ' · Hoy' : ''}</h2>
      {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}

      {logs.isPending ? (
        <AppCard><SkeletonLoader lines={5} /></AppCard>
      ) : logs.isError ? (
        <ErrorState message="No pudimos cargar tu diario." onRetry={() => void logs.refetch()} />
      ) : (
        <ul className="flex flex-col gap-3">
          {MEAL_TYPE_ORDER.filter((t) => t !== MealType.OTHER || dayLogs.some((l) => l.mealType === t)).map((type) => {
            const items = dayLogs.filter((l) => l.mealType === type);
            const planned = plannedFor(type);
            return (
              <li key={type} className="rounded-neo-card border border-neo-border bg-neo-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base">{MEAL_TYPE_LABEL[type]}</h3>
                    {planned && (
                      <p className="text-xs text-neo-muted">
                        Plan: {planned.title}{planned.scheduledTime ? ` · ${planned.scheduledTime}` : ''}
                      </p>
                    )}
                  </div>
                  <AppButton
                    variant={items.length ? 'ghost' : 'secondary'}
                    onClick={() => setEditing({ mealType: type, planned, log: null })}
                    aria-label={`${items.length ? 'Agregar otro registro de' : 'Registrar'} ${MEAL_TYPE_LABEL[type].toLowerCase()}`}
                  >
                    <Plus className="size-4" aria-hidden="true" /> {items.length ? 'Agregar otro' : 'Registrar'}
                  </AppButton>
                </div>

                {items.map((l) => (
                  <div key={l.id} className="mt-3 flex gap-3 border-t border-neo-border pt-3">
                    {l.imageUrl && <img src={l.imageUrl} alt={`Foto de ${MEAL_TYPE_LABEL[l.mealType].toLowerCase()}`} loading="lazy" className="size-20 shrink-0 rounded-neo-input object-cover" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <MealLogStatusBadge status={l.status} />
                        <span className="text-xs text-neo-muted">{l.time}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line break-words text-sm">{l.description || <span className="text-neo-muted">Sin descripción</span>}</p>
                      {l.coachComment && (l.status === MealLogStatus.REVIEWED || l.status === MealLogStatus.NEEDS_CHANGES) && (
                        <p className="mt-2 rounded-neo-input bg-neo-pink-light p-2 text-sm">
                          <strong>Tu coach:</strong> {l.coachComment}
                        </p>
                      )}
                      {EDITABLE.includes(l.status) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <AppButton variant="secondary" onClick={() => setEditing({ mealType: l.mealType, planned, log: l })} aria-label={`Editar registro de ${MEAL_TYPE_LABEL[l.mealType].toLowerCase()}`}>
                            <Pencil className="size-4" aria-hidden="true" /> Editar
                          </AppButton>
                          <AppButton
                            loading={send.isPending && send.variables === l.id}
                            disabled={!l.description.trim()}
                            title={!l.description.trim() ? 'Agrega una descripción para poder enviar' : undefined}
                            onClick={() => { setActionError(null); send.mutate(l.id); }}
                            aria-label={`Enviar a mi coach el registro de ${MEAL_TYPE_LABEL[l.mealType].toLowerCase()}`}
                          >
                            <Send className="size-4" aria-hidden="true" /> {l.status === MealLogStatus.NEEDS_CHANGES ? 'Reenviar' : 'Enviar'}
                          </AppButton>
                          {l.status === MealLogStatus.DRAFT && (
                            <AppButton variant="ghost" loading={remove.isPending && remove.variables === l.id} onClick={() => { setActionError(null); remove.mutate(l.id); }} aria-label={`Eliminar borrador de ${MEAL_TYPE_LABEL[l.mealType].toLowerCase()}`}>
                              <Trash2 className="size-4" aria-hidden="true" />
                            </AppButton>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      {!logs.isPending && !logs.isError && dayLogs.length === 0 && (
        <p className="text-center text-sm text-neo-muted">Aún no registras nada este día. Anota lo que realmente comas, aunque no coincida con el plan.</p>
      )}

      {editing && <MealLogModal key={editing.log?.id ?? editing.mealType} date={date} mealType={editing.mealType} planned={editing.planned} log={editing.log} onClose={() => setEditing(null)} />}
    </div>
  );
}
