import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AssignmentDto } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { Modal } from '@/components/ui/Modal';
import { assignmentsApi } from '@/features/workouts/workoutsApi';
import { ApiError } from '@/services/apiClient';
import { todayKey } from '@/utils/calendar';

export function RescheduleModal({ assignment, onClose }: { assignment: AssignmentDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(assignment.scheduledDate);
  const [time, setTime] = useState(assignment.scheduledTime ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => assignmentsApi.update(assignment.id, { scheduledDate: date, scheduledTime: time || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError && err.statusCode < 500 ? err.message : 'No pudimos reprogramar. Intenta de nuevo.'),
  });

  const pastDate = date < todayKey();
  const unchanged = date === assignment.scheduledDate && (time || null) === assignment.scheduledTime;

  return (
    <Modal open title="Reprogramar entrenamiento" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (!pastDate && !unchanged) save.mutate();
        }}
      >
        <p className="text-sm">
          {assignment.workout.title} · {assignment.user.firstName} {assignment.user.lastName}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <AppInput label="Nueva fecha" type="date" value={date} min={todayKey()} onChange={(e) => setDate(e.target.value)} error={pastDate ? 'La fecha no puede ser pasada' : undefined} />
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
          <AppButton type="submit" disabled={pastDate || unchanged || !date} loading={save.isPending}>
            Guardar
          </AppButton>
        </div>
      </form>
    </Modal>
  );
}
