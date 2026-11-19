import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RiskCode } from '@neo/shared-types';
import { createFollowUpSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/services/apiClient';
import { RISK_LABEL } from './labels';
import { statsApi } from './statsApi';

export interface FollowUpModalProps {
  userId: string;
  userName: string;
  /** Alertas vigentes: quedan registradas junto con la acción. */
  reasons: RiskCode[];
  onClose: () => void;
}

/** HU-27: la Coach deja constancia de qué hizo frente a una alerta (llamó, escribió, ajustó el plan…). */
export function FollowUpModal({ userId, userName, reasons, onClose }: FollowUpModalProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => statsApi.createFollowUp(userId, { note: note.trim(), reasons }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['coach-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['user-stats', userId] });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos guardar el seguimiento.'),
  });

  const submit = () => {
    const parsed = createFollowUpSchema.safeParse({ note, reasons });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa el texto');
    setError(null);
    save.mutate();
  };

  return (
    <Modal open title={`Seguimiento de ${userName}`} onClose={onClose}>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {reasons.length > 0 && <p className="text-sm text-neo-muted">Alertas: {reasons.map((r) => RISK_LABEL[r]).join(', ')}.</p>}
        <div className="flex flex-col gap-1">
          <label htmlFor="follow-up-note" className="text-sm font-medium">¿Qué hiciste?</label>
          <textarea
            id="follow-up-note"
            rows={4}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej.: Le escribí por mensaje y quedamos en retomar el lunes."
            className="rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm"
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
          <AppButton type="submit" loading={save.isPending}>Guardar seguimiento</AppButton>
        </div>
      </form>
    </Modal>
  );
}
