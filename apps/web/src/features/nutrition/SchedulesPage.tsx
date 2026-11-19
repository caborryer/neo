import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FoodScheduleDto } from '@neo/shared-types';
import { upsertFoodScheduleSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { MEAL_TYPE_LABEL } from './labels';
import { NutritionTabs } from './NutritionTabs';
import { schedulesApi } from './schedulesApi';

function Row({ schedule }: { schedule: FoodScheduleDto }) {
  const queryClient = useQueryClient();
  const [time, setTime] = useState(schedule.scheduledTime);
  const [reminder, setReminder] = useState(schedule.reminderEnabled);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = time !== schedule.scheduledTime || reminder !== schedule.reminderEnabled || schedule.isDefault;
  const label = MEAL_TYPE_LABEL[schedule.mealType];

  const save = useMutation({
    mutationFn: () => schedulesApi.save(schedule.mealType, { scheduledTime: time, reminderEnabled: reminder }),
    onSuccess: () => {
      setMsg({ ok: true, text: 'Guardado.' });
      void queryClient.invalidateQueries({ queryKey: ['food-schedules'] });
    },
    onError: (e) => setMsg({ ok: false, text: e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos guardar el horario.' }),
  });

  const submit = () => {
    const parsed = upsertFoodScheduleSchema.safeParse({ scheduledTime: time, reminderEnabled: reminder });
    if (!parsed.success) return setMsg({ ok: false, text: parsed.error.issues[0]?.message ?? 'Hora inválida' });
    setMsg(null);
    save.mutate();
  };

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <label htmlFor={`time-${schedule.mealType}`} className="w-28 text-sm font-medium">{label}</label>
        <input
          id={`time-${schedule.mealType}`}
          type="time"
          value={time}
          onChange={(e) => { setTime(e.target.value); setMsg(null); }}
          className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={reminder} onChange={(e) => { setReminder(e.target.checked); setMsg(null); }} className="size-4" />
          <span>Recordarme<span className="sr-only"> {label.toLowerCase()}</span></span>
        </label>
        <AppButton variant="secondary" disabled={!dirty} loading={save.isPending} onClick={submit} aria-label={`Guardar horario de ${label.toLowerCase()}`}>
          Guardar
        </AppButton>
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-xs text-neo-green' : 'text-xs text-red-700'}>{msg.text}</p>}
    </li>
  );
}

/** HU-23 · U05: horarios de comida y preferencia de recordatorio. */
export function SchedulesPage() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['food-schedules'], queryFn: schedulesApi.list });
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <NutritionTabs />
      <h1>Horarios de comida</h1>
      <p className="text-sm text-neo-muted">
        Define a qué hora sueles comer. Las horas mostradas con valor sugerido aún no están guardadas.
      </p>
      <AppCard>
        {isPending ? (
          <SkeletonLoader lines={5} />
        ) : error ? (
          <ErrorState message="No pudimos cargar tus horarios." onRetry={() => void refetch()} />
        ) : (
          <ul className="divide-y divide-neo-border">
            {data.map((s) => (
              <Row key={s.mealType} schedule={s} />
            ))}
          </ul>
        )}
      </AppCard>
      <p role="note" className="rounded-neo-input bg-neo-neutral px-3 py-2 text-xs text-neo-muted">
        Por ahora guardamos tu preferencia de recordatorio, pero todavía no enviamos avisos automáticos a tu celular o correo.
      </p>
    </div>
  );
}
