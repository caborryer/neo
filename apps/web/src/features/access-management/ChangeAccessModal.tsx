import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserStatus } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { Modal } from '@/components/ui/Modal';
import { ApiError } from '@/services/apiClient';
import { endOfDateInput, toDateInputValue } from '@/utils/format';
import { isExpired, STATUS_LABEL } from '@/features/users/userStatus';
import { usersApi, type UserSummary } from '@/features/users/usersApi';

export interface ChangeAccessTarget {
  status: UserStatus;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
}

const MAX_REASON = 250;

/** HU-06/07: confirmación con motivo opcional y, al dejar la cuenta Activa, fecha de vencimiento. */
export function ChangeAccessModal({ user, target, onClose }: { user: UserSummary; target: ChangeAccessTarget | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [expiry, setExpiry] = useState(() => (user.accessExpiresAt && !isExpired(user.accessExpiresAt) ? toDateInputValue(user.accessExpiresAt) : ''));
  const [error, setError] = useState<string | null>(null);

  const sendsExpiry = target?.status === UserStatus.ACTIVE;

  const mutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error('sin destino');
      return usersApi.changeAccess(user.id, {
        status: target.status,
        reason: reason.trim() || undefined,
        // Al dejar Activa se envía siempre: una fecha o null (sin vencimiento). Si no, un vencimiento
        // pasado seguiría bloqueando a la usuaria aunque la reactiven.
        ...(sendsExpiry ? { accessExpiresAt: expiry ? endOfDateInput(expiry).toISOString() : null } : {}),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['user', user.id] }),
        queryClient.invalidateQueries({ queryKey: ['access-history', user.id] }),
      ]);
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError && err.statusCode < 500 ? err.message : 'No pudimos guardar el cambio. Intenta de nuevo.'),
  });

  if (!target) return null;
  const expiryInPast = !!expiry && endOfDateInput(expiry).getTime() <= Date.now();

  return (
    <Modal open title={target.title} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (expiryInPast) return;
          mutation.mutate();
        }}
      >
        {target.description && <p className="text-sm text-neo-muted">{target.description}</p>}
        <p className="text-sm">
          {user.firstName} {user.lastName}: <strong>{STATUS_LABEL[user.status]}</strong> → <strong>{STATUS_LABEL[target.status]}</strong>
        </p>
        {sendsExpiry && (
          <AppInput
            label="Acceso hasta (opcional)"
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            hint="Vacío = sin vencimiento."
            error={expiryInPast ? 'La fecha debe ser futura' : undefined}
          />
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="access-reason" className="text-sm font-medium">
            Motivo (opcional)
          </label>
          <textarea
            id="access-reason"
            value={reason}
            maxLength={MAX_REASON}
            rows={3}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm"
          />
          <span className="self-end text-xs text-neo-muted">
            {reason.length}/{MAX_REASON}
          </span>
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
          <AppButton type="submit" variant={target.danger ? 'danger' : 'primary'} loading={mutation.isPending}>
            {target.confirmLabel}
          </AppButton>
        </div>
      </form>
    </Modal>
  );
}
