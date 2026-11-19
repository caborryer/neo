import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserStatus } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { Modal } from '@/components/ui/Modal';
import { usersApi } from '@/features/users/usersApi';
import { assignmentsApi, workoutsApi, type AssignResult } from '@/features/workouts/workoutsApi';
import { ApiError } from '@/services/apiClient';
import { todayKey } from '@/utils/calendar';

/** HU-10: asignar una clase publicada a una o varias usuarias activas en una fecha (hora opcional). */
export function AssignModal({ defaultDate, defaultUserId, onClose }: { defaultDate: string; defaultUserId?: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [workoutId, setWorkoutId] = useState('');
  const [selected, setSelected] = useState<string[]>(defaultUserId ? [defaultUserId] : []);
  const [date, setDate] = useState(defaultDate < todayKey() ? todayKey() : defaultDate);
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignResult | null>(null);

  const workouts = useQuery({ queryKey: ['workouts', 'options'], queryFn: () => workoutsApi.list({ page: 1, limit: 100, published: 'true' }) });
  const users = useQuery({
    queryKey: ['users', 'options'],
    queryFn: () => usersApi.list({ page: 1, limit: 100, status: UserStatus.ACTIVE, sortBy: 'firstName', sortOrder: 'asc' }),
  });

  const assign = useMutation({
    mutationFn: () => assignmentsApi.create({ workoutId, userIds: selected, scheduledDate: date, scheduledTime: time || null }),
    onSuccess: async (r) => {
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      if (r.skipped.length === 0) onClose();
      else setResult(r);
    },
    onError: (err) => setError(err instanceof ApiError && err.statusCode < 500 ? err.message : 'No pudimos asignar. Intenta de nuevo.'),
  });

  const nameOf = (id: string) => {
    const u = users.data?.data.find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : 'Usuaria';
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const noWorkouts = workouts.isSuccess && workouts.data.data.length === 0;
  const noUsers = users.isSuccess && users.data.data.length === 0;
  const pastDate = date < todayKey();

  return (
    <Modal open title="Asignar clase" onClose={onClose}>
      {result ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="rounded-neo-input bg-neo-green-light px-3 py-2 text-sm text-neo-green">
            {result.created.length > 0 ? `Asignada a ${result.created.length} usuaria${result.created.length > 1 ? 's' : ''}.` : 'No se asignó a nadie.'}
          </p>
          <div>
            <p className="text-sm font-medium">No se pudo asignar a:</p>
            <ul className="mt-1 list-disc pl-5 text-sm text-neo-muted">
              {result.skipped.map((s) => (
                <li key={s.userId}>
                  {nameOf(s.userId)}: {s.reason}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end">
            <AppButton onClick={onClose}>Listo</AppButton>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!workoutId || selected.length === 0 || pastDate) return;
            assign.mutate();
          }}
        >
          {noWorkouts ? (
            <p className="rounded-neo-input bg-amber-50 px-3 py-2 text-sm text-amber-900">Primero publica al menos una clase en Entrenamientos.</p>
          ) : (
            <AppSelect
              label="Clase"
              value={workoutId}
              onChange={(e) => setWorkoutId(e.target.value)}
              options={[{ value: '', label: 'Selecciona una clase…' }, ...(workouts.data?.data.map((w) => ({ value: w.id, label: `${w.title} (${w.durationMinutes} min)` })) ?? [])]}
            />
          )}
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-medium">Usuarias</legend>
            {noUsers ? (
              <p className="text-sm text-neo-muted">No hay usuarias activas.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-neo-input border border-neo-border p-1">
                {users.data?.data.map((u) => (
                  <label key={u.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-2 text-sm hover:bg-neo-neutral">
                    <input type="checkbox" className="size-5 accent-[var(--color-neo-primary)]" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
                    {u.firstName} {u.lastName}
                  </label>
                ))}
              </div>
            )}
            <span className="text-xs text-neo-muted">{selected.length} seleccionada{selected.length === 1 ? '' : 's'}</span>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput label="Fecha" type="date" value={date} min={todayKey()} onChange={(e) => setDate(e.target.value)} error={pastDate ? 'La fecha no puede ser pasada' : undefined} />
            <AppInput label="Hora (opcional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          {error && (
            <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <AppButton variant="secondary" onClick={onClose}>
              Cancelar
            </AppButton>
            <AppButton type="submit" disabled={!workoutId || selected.length === 0 || !date || pastDate} loading={assign.isPending}>
              Asignar
            </AppButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
