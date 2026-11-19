import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { formatDateTime } from '@/utils/format';
import { STATUS_LABEL } from '@/features/users/userStatus';
import { usersApi } from '@/features/users/usersApi';

/** HU-28: historial inmutable de cambios de acceso (quién, cuándo, de qué estado a cuál y por qué). */
export function AccessHistory({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['access-history', userId, page],
    queryFn: () => usersApi.accessHistory(userId, page),
    placeholderData: keepPreviousData,
  });

  return (
    <AppCard title="Historial de acceso">
      {isPending ? (
        <SkeletonLoader lines={3} />
      ) : isError ? (
        <ErrorState message="No pudimos cargar el historial." onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <p className="text-sm text-neo-muted">Aún no hay cambios registrados.</p>
      ) : (
        <>
          <ol className="flex flex-col divide-y divide-neo-border">
            {data.data.map((e) => (
              <li key={e.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5 font-medium">
                  {e.previousStatus ? (
                    <>
                      {STATUS_LABEL[e.previousStatus]} <ArrowRight className="size-3.5 text-neo-muted" aria-label="a" /> {STATUS_LABEL[e.newStatus]}
                    </>
                  ) : (
                    <>Creada como {STATUS_LABEL[e.newStatus]}</>
                  )}
                </div>
                <p className="text-xs text-neo-muted">
                  {formatDateTime(e.createdAt)} · {e.changedBy}
                </p>
                {e.reason && <p className="mt-1 text-neo-dark">“{e.reason}”</p>}
              </li>
            ))}
          </ol>
          {data.meta.totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-neo-muted">
                Página {data.meta.page} de {data.meta.totalPages}
              </span>
              <div className="flex gap-2">
                <AppButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </AppButton>
                <AppButton variant="secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                  Siguiente
                </AppButton>
              </div>
            </div>
          )}
        </>
      )}
    </AppCard>
  );
}
