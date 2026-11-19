import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { UserStatus } from '@neo/shared-types';
import { createPlanAssignmentSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { usersApi } from '@/features/users/usersApi';
import { ApiError } from '@/services/apiClient';
import { coachRoutes } from '@/app/routes';
import { todayKey } from '@/utils/calendar';
import { formatDate } from '@/utils/format';
import { PhaseBadge } from './labels';
import { plansApi, type AssignPlanResult } from './nutritionApi';

/** HU-12 · C06: asignar una versión publicada con vigencia, y ver/finalizar asignaciones. */
export function PlanAssignmentsPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [versionId, setVersionId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssignPlanResult | null>(null);

  const plan = useQuery({ queryKey: ['nutrition-plan', id], queryFn: () => plansApi.get(id) });
  const assignments = useQuery({ queryKey: ['nutrition-assignments', id], queryFn: () => plansApi.assignments(id) });
  const users = useQuery({
    queryKey: ['users', 'options'],
    queryFn: () => usersApi.list({ page: 1, limit: 100, status: UserStatus.ACTIVE, sortBy: 'firstName', sortOrder: 'asc' }),
  });

  const published = plan.data?.versions.filter((v) => v.publishedAt) ?? [];
  const effectiveVersion = versionId || published[0]?.id || '';

  const assign = useMutation({
    mutationFn: async () => {
      const body = { versionId: effectiveVersion, userIds: selected, startDate, endDate: endDate || null };
      const parsed = createPlanAssignmentSchema.safeParse(body);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return plansApi.assign(id, body);
    },
    onSuccess: async (r) => {
      setResult(r);
      setError(null);
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ['nutrition-assignments', id] });
      await queryClient.invalidateQueries({ queryKey: ['nutrition-plan', id] });
    },
    onError: (e) => setError(e instanceof ApiError && e.statusCode < 500 ? e.message : e instanceof Error && !(e instanceof ApiError) ? e.message : 'No pudimos asignar. Intenta de nuevo.'),
  });
  const end = useMutation({
    mutationFn: (assignmentId: string) => plansApi.endAssignment(assignmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nutrition-assignments', id] }),
  });

  const nameOf = (userId: string) => {
    const u = users.data?.data.find((x) => x.id === userId);
    return u ? `${u.firstName} ${u.lastName}` : 'Usuaria';
  };
  const toggle = (userId: string) => setSelected((s) => (s.includes(userId) ? s.filter((x) => x !== userId) : [...s, userId]));

  if (plan.isPending) return <AppCard><SkeletonLoader lines={5} /></AppCard>;
  if (plan.isError) return <ErrorState message="No pudimos cargar el plan." onRetry={() => void plan.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <Link to={coachRoutes.nutritionPlan(id)} className="inline-flex items-center gap-1 text-sm text-neo-primary-dark">
        <ArrowLeft className="size-4" aria-hidden="true" /> {plan.data.name}
      </Link>
      <h1>Asignar plan</h1>

      {published.length === 0 ? (
        <EmptyState title="No hay versiones publicadas" description="Publica una versión del plan para poder asignarla." action={<Link to={coachRoutes.nutritionPlan(id)}><AppButton>Ir al plan</AppButton></Link>} />
      ) : (
        <AppCard>
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setResult(null);
              setError(null);
              assign.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <AppSelect
                label="Versión"
                value={effectiveVersion}
                onChange={(e) => setVersionId(e.target.value)}
                options={published.map((v) => ({ value: v.id, label: `Versión ${v.versionNumber} · ${formatDate(v.publishedAt)}` }))}
              />
              <AppInput label="Inicio" type="date" min={todayKey()} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              <AppInput label="Fin (opcional)" type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} hint="Sin fecha de fin = hasta que la reemplaces" />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">Usuarias ({selected.length} seleccionadas)</legend>
              {users.isPending ? (
                <SkeletonLoader lines={3} />
              ) : users.isError ? (
                <ErrorState message="No pudimos cargar las usuarias." onRetry={() => void users.refetch()} />
              ) : users.data.data.length === 0 ? (
                <p className="text-sm text-neo-muted">No hay usuarias con acceso activo.</p>
              ) : (
                <ul className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
                  {users.data.data.map((u) => (
                    <li key={u.id}>
                      <label className="flex min-h-11 items-center gap-2 rounded-neo-input px-2 text-sm hover:bg-neo-neutral">
                        <input type="checkbox" className="size-4" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
                        {u.firstName} {u.lastName}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>

            <p className="text-xs text-neo-muted">Si una usuaria ya tiene un plan vigente, se finaliza el día anterior al inicio de este.</p>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <div className="flex justify-end">
              <AppButton type="submit" loading={assign.isPending} disabled={selected.length === 0}>Asignar plan</AppButton>
            </div>
          </form>

          {result && (
            <div role="status" className="mt-4 rounded-neo-card bg-neo-green-light p-3 text-sm text-neo-green">
              <p className="font-semibold">{result.created.length} {result.created.length === 1 ? 'asignación creada' : 'asignaciones creadas'}.</p>
              {result.skipped.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-amber-900">
                  {result.skipped.map((s) => <li key={s.userId}>{nameOf(s.userId)}: {s.reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </AppCard>
      )}

      <AppCard>
        <h2 className="mb-3 text-base">Asignaciones</h2>
        {assignments.isPending ? (
          <SkeletonLoader lines={3} />
        ) : assignments.isError ? (
          <ErrorState message="No pudimos cargar las asignaciones." onRetry={() => void assignments.refetch()} />
        ) : assignments.data.length === 0 ? (
          <p className="text-sm text-neo-muted">Este plan aún no está asignado a nadie.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neo-border">
            {assignments.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{a.userName}</p>
                  <p className="text-xs text-neo-muted">
                    Versión {a.versionNumber} · {formatDate(a.startDate)} → {a.endDate ? formatDate(a.endDate) : 'sin fin'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PhaseBadge phase={a.phase} />
                  {a.status === 'ACTIVE' && a.phase !== 'PAST' && (
                    <AppButton
                      variant="ghost"
                      loading={end.isPending && end.variables === a.id}
                      onClick={() => end.mutate(a.id)}
                      aria-label={`Finalizar plan de ${a.userName}`}
                    >
                      Finalizar
                    </AppButton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {end.isError && <p role="alert" className="mt-2 text-sm text-red-700">No pudimos finalizar la asignación.</p>}
      </AppCard>
    </div>
  );
}
