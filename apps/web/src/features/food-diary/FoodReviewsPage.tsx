import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react';
import { MealLogStatus, UserStatus, type MealLogDto } from '@neo/shared-types';
import { reviewMealLogSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { MEAL_TYPE_LABEL, MealLogStatusBadge } from '@/features/nutrition/labels';
import { mealLogsApi } from '@/features/nutrition/nutritionApi';
import { usersApi } from '@/features/users/usersApi';
import { ApiError } from '@/services/apiClient';
import { dayLabel } from '@/utils/calendar';

const LIMIT = 10;
type StatusFilter = MealLogStatus | '';

/** HU-13 · C07: la Coach revisa el diario, aprueba o pide cambios con una observación. */
export function FoodReviewsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>(MealLogStatus.SUBMITTED);
  const [searchParams] = useSearchParams();
  const [userId, setUserId] = useState(searchParams.get('userId') ?? '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [reviewing, setReviewing] = useState<MealLogDto | null>(null);

  const params = { page, limit: LIMIT, status: status || undefined, userId: userId || undefined, from: from || undefined, to: to || undefined };
  const logs = useQuery({ queryKey: ['coach-meal-logs', params], queryFn: () => mealLogsApi.listForCoach(params), placeholderData: keepPreviousData });
  const users = useQuery({
    queryKey: ['users', 'options'],
    queryFn: () => usersApi.list({ page: 1, limit: 100, status: UserStatus.ACTIVE, sortBy: 'firstName', sortOrder: 'asc' }),
  });
  const reset = (fn: () => void) => { fn(); setPage(1); };
  const rangeInvalid = !!from && !!to && from > to;

  return (
    <div className="flex flex-col gap-4">
      <h1>Revisión alimenticia</h1>

      <AppCard>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Estado
            <select value={status} onChange={(e) => reset(() => setStatus(e.target.value as StatusFilter))} className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm font-normal">
              <option value={MealLogStatus.SUBMITTED}>Pendientes de revisión</option>
              <option value={MealLogStatus.NEEDS_CHANGES}>Con cambios solicitados</option>
              <option value={MealLogStatus.REVIEWED}>Revisados</option>
              <option value="">Todos</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Usuaria
            <select value={userId} onChange={(e) => reset(() => setUserId(e.target.value))} className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm font-normal">
              <option value="">Todas</option>
              {users.data?.data.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Desde
            <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Hasta
            <input type="date" value={to} min={from || undefined} onChange={(e) => reset(() => setTo(e.target.value))} className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm font-normal" />
          </label>
        </div>
        {rangeInvalid && <p role="alert" className="mt-2 text-sm text-red-700">La fecha final debe ser posterior a la inicial.</p>}
      </AppCard>

      {logs.isPending ? (
        <AppCard><SkeletonLoader lines={5} /></AppCard>
      ) : logs.isError ? (
        <ErrorState message={rangeInvalid ? 'Corrige el rango de fechas.' : 'No pudimos cargar los registros.'} onRetry={() => void logs.refetch()} />
      ) : logs.data.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-8" aria-hidden="true" />}
          title={status === MealLogStatus.SUBMITTED ? 'No hay registros por revisar' : 'Sin resultados'}
          description={status === MealLogStatus.SUBMITTED ? 'Cuando una usuaria envíe su diario, aparecerá aquí.' : 'Ningún registro coincide con los filtros.'}
        />
      ) : (
        <div className={logs.isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <ul className="flex flex-col gap-3">
            {logs.data.data.map((l) => (
              <li key={l.id} className="flex gap-3 rounded-neo-card border border-neo-border bg-neo-surface p-4">
                {l.imageUrl && (
                  <a href={l.imageUrl} target="_blank" rel="noreferrer" aria-label={`Ver foto de ${l.userName} en grande`} className="shrink-0">
                    <img src={l.imageUrl} alt={`Foto de ${MEAL_TYPE_LABEL[l.mealType].toLowerCase()} de ${l.userName}`} loading="lazy" className="size-24 rounded-neo-input object-cover" />
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base">{l.userName}</h3>
                    <MealLogStatusBadge status={l.status} />
                  </div>
                  <p className="text-xs text-neo-muted">
                    {MEAL_TYPE_LABEL[l.mealType]} · {dayLabel(l.date)} {l.time}
                    {l.plannedMealTitle ? ` · Plan: ${l.plannedMealTitle}` : ' · Fuera del plan'}
                  </p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm">{l.description || <span className="text-neo-muted">Sin descripción</span>}</p>
                  {l.coachComment && <p className="mt-2 rounded-neo-input bg-neo-neutral p-2 text-sm"><strong>Tu observación:</strong> {l.coachComment}</p>}
                  {l.status === MealLogStatus.SUBMITTED && (
                    <AppButton className="mt-2" onClick={() => setReviewing(l)} aria-label={`Revisar registro de ${l.userName}`}>Revisar</AppButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-neo-muted">Página {logs.data.meta.page} de {logs.data.meta.totalPages} · {logs.data.meta.total} registros</span>
            <div className="flex gap-2">
              <AppButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" aria-hidden="true" /></AppButton>
              <AppButton variant="secondary" disabled={page >= logs.data.meta.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" aria-hidden="true" /></AppButton>
            </div>
          </nav>
        </div>
      )}

      {reviewing && (
        <ReviewModal
          log={reviewing}
          onClose={() => setReviewing(null)}
          onDone={async () => {
            setReviewing(null);
            await queryClient.invalidateQueries({ queryKey: ['coach-meal-logs'] });
          }}
        />
      )}
    </div>
  );
}

function ReviewModal({ log, onClose, onDone }: { log: MealLogDto; onClose: () => void; onDone: () => Promise<void> }) {
  const [decision, setDecision] = useState<'REVIEWED' | 'NEEDS_CHANGES'>('REVIEWED');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: () => {
      const body = { status: decision, comment: comment.trim() || null };
      const parsed = reviewMealLogSchema.safeParse(body);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return mealLogsApi.review(log.id, body);
    },
    onSuccess: onDone,
    onError: (e) => setError(e instanceof ApiError ? (e.statusCode < 500 ? e.message : 'No pudimos guardar la revisión.') : e instanceof Error ? e.message : 'No pudimos guardar la revisión.'),
  });

  return (
    <Modal open title={`Revisar · ${log.userName}`} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          review.mutate();
        }}
      >
        <p className="text-sm">{MEAL_TYPE_LABEL[log.mealType]}: {log.description || 'Sin descripción'}</p>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium">Resultado</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="decision" checked={decision === 'REVIEWED'} onChange={() => setDecision('REVIEWED')} className="size-4" /> Aprobar
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="radio" name="decision" checked={decision === 'NEEDS_CHANGES'} onChange={() => setDecision('NEEDS_CHANGES')} className="size-4" /> Solicitar cambios o aclaración
          </label>
        </fieldset>
        <div className="flex flex-col gap-1">
          <label htmlFor="review-comment" className="text-sm font-medium">
            Observación {decision === 'REVIEWED' ? '(opcional)' : '(obligatoria)'}
          </label>
          <textarea id="review-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} className="rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm" />
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
          <AppButton type="submit" loading={review.isPending}>Guardar revisión</AppButton>
        </div>
      </form>
    </Modal>
  );
}
