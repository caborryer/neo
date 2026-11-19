import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Pencil, Send, Users } from 'lucide-react';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { coachRoutes } from '@/app/routes';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';
import { WeekPlan } from './PlanDays';
import { plansApi } from './nutritionApi';

/** HU-11 / HU-12 · C06: detalle del plan, sus versiones y acciones (editar borrador, publicar, duplicar, asignar). */
export function PlanDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [dupName, setDupName] = useState('');
  const [dupTemplate, setDupTemplate] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const plan = useQuery({ queryKey: ['nutrition-plan', id], queryFn: () => plansApi.get(id) });
  const versionId = picked ?? plan.data?.versions[0]?.id;
  const version = useQuery({
    queryKey: ['nutrition-version', id, versionId],
    queryFn: () => plansApi.getVersion(id, versionId!),
    enabled: !!versionId,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['nutrition-plan', id] });
    await queryClient.invalidateQueries({ queryKey: ['nutrition-version', id] });
    await queryClient.invalidateQueries({ queryKey: ['nutrition-plans'] });
  };
  const fail = (fallback: string) => (e: unknown) => {
    setError(e instanceof ApiError && e.statusCode < 500 ? e.message : fallback);
    setProblems(e instanceof ApiError ? e.details.map((d) => d.message) : []);
  };

  const publish = useMutation({
    mutationFn: () => plansApi.publish(id, versionId!),
    onSuccess: async () => {
      setConfirmPublish(false);
      setProblems([]);
      await refresh();
    },
    onError: (e) => {
      setConfirmPublish(false);
      fail('No pudimos publicar la versión.')(e);
    },
  });
  const newVersion = useMutation({
    mutationFn: () => plansApi.createVersion(id),
    onSuccess: async (v) => {
      setPicked(v.id);
      await refresh();
      navigate(coachRoutes.nutritionPlanEdit(id));
    },
    onError: fail('No pudimos crear la versión.'),
  });
  const archive = useMutation({
    mutationFn: (isActive: boolean) => plansApi.update(id, { isActive }),
    onSuccess: refresh,
    onError: fail('No pudimos actualizar el plan.'),
  });
  const duplicate = useMutation({
    mutationFn: () => plansApi.duplicate(id, { name: dupName.trim(), isTemplate: dupTemplate }),
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: ['nutrition-plans'] });
      setDuplicating(false);
      navigate(coachRoutes.nutritionPlan(copy.id));
    },
    onError: fail('No pudimos duplicar el plan.'),
  });

  if (plan.isPending) return <AppCard><SkeletonLoader lines={6} /></AppCard>;
  if (plan.isError) return <ErrorState message="No pudimos cargar el plan." onRetry={() => void plan.refetch()} />;

  const p = plan.data;
  const draft = p.versions.find((v) => v.publishedAt === null);
  const hasPublished = p.versions.some((v) => v.publishedAt !== null);
  const shown = p.versions.find((v) => v.id === versionId);

  return (
    <div className="flex flex-col gap-4">
      <Link to={coachRoutes.nutritionPlans} className="inline-flex items-center gap-1 text-sm text-neo-primary-dark">
        <ArrowLeft className="size-4" aria-hidden="true" /> Planes nutricionales
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1>{p.name}</h1>
            {p.isTemplate && <AppBadge tone="info">Plantilla</AppBadge>}
            {!p.isActive && <AppBadge tone="neutral">Archivado</AppBadge>}
          </div>
          {p.description && <p className="mt-1 text-sm text-neo-muted">{p.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {draft ? (
            <Link to={coachRoutes.nutritionPlanEdit(id)}>
              <AppButton variant="secondary"><Pencil className="size-4" aria-hidden="true" /> Editar borrador</AppButton>
            </Link>
          ) : (
            <AppButton variant="secondary" loading={newVersion.isPending} onClick={() => newVersion.mutate()}>
              <Pencil className="size-4" aria-hidden="true" /> Nueva versión
            </AppButton>
          )}
          <AppButton variant="secondary" onClick={() => { setDupName(`Copia de ${p.name}`); setDupTemplate(false); setDuplicating(true); }}>
            <Copy className="size-4" aria-hidden="true" /> Duplicar
          </AppButton>
          {hasPublished && p.isActive ? (
            <Link to={coachRoutes.nutritionPlanAssignments(id)}>
              <AppButton><Users className="size-4" aria-hidden="true" /> Asignar</AppButton>
            </Link>
          ) : (
            <AppButton disabled title={!p.isActive ? 'El plan está archivado' : 'Publica una versión para poder asignar'}>
              <Users className="size-4" aria-hidden="true" /> Asignar
            </AppButton>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-neo-card border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          <p>{error}</p>
          {problems.length > 0 && <ul className="mt-1 list-disc pl-5">{problems.map((m, i) => <li key={i}>{m}</li>)}</ul>}
        </div>
      )}

      <AppCard>
        <h2 className="mb-2 text-base">Versiones</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Versiones del plan">
          {p.versions.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={v.id === versionId}
              onClick={() => setPicked(v.id)}
              className={cn('min-h-11 rounded-neo-button border px-3 text-sm', v.id === versionId ? 'border-neo-primary bg-neo-pink-light text-neo-primary-dark' : 'border-neo-border bg-neo-surface hover:bg-neo-neutral')}
            >
              v{v.versionNumber} · {v.publishedAt ? `Publicada ${formatDate(v.publishedAt)}` : 'Borrador'}
              {v.assignmentCount > 0 && <span className="text-xs text-neo-muted"> · {v.assignmentCount} asignaciones</span>}
            </button>
          ))}
        </div>

        {shown && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-neo-muted">
              {shown.publishedAt
                ? 'Versión publicada: no se puede modificar. Para cambiarla, crea una nueva versión.'
                : 'Borrador: las usuarias no lo ven hasta que lo publiques.'}
            </p>
            {!shown.publishedAt && (
              <AppButton onClick={() => setConfirmPublish(true)}>
                <Send className="size-4" aria-hidden="true" /> Publicar versión
              </AppButton>
            )}
          </div>
        )}
      </AppCard>

      <AppCard>
        {version.isPending ? (
          <SkeletonLoader lines={5} />
        ) : version.isError ? (
          <ErrorState message="No pudimos cargar la versión." onRetry={() => void version.refetch()} />
        ) : (
          <div className="flex flex-col gap-3">
            {version.data.notes && <p className="rounded-neo-input bg-neo-neutral p-3 text-sm">{version.data.notes}</p>}
            <WeekPlan key={version.data.id} days={version.data.days} />
          </div>
        )}
      </AppCard>

      <div>
        <AppButton variant="ghost" loading={archive.isPending} onClick={() => archive.mutate(!p.isActive)}>
          {p.isActive ? 'Archivar plan' : 'Reactivar plan'}
        </AppButton>
      </div>

      <Modal open={confirmPublish} title={`Publicar versión ${shown?.versionNumber ?? ''}`} onClose={() => setConfirmPublish(false)}>
        <p className="text-sm">
          Al publicarla, esta versión queda <strong>congelada</strong>: no podrás editarla, solo crear versiones nuevas. Después podrás asignarla a tus usuarias.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <AppButton variant="secondary" onClick={() => setConfirmPublish(false)}>Cancelar</AppButton>
          <AppButton loading={publish.isPending} onClick={() => publish.mutate()}>Publicar</AppButton>
        </div>
      </Modal>

      <Modal open={duplicating} title="Duplicar plan" onClose={() => setDuplicating(false)}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (dupName.trim()) duplicate.mutate();
          }}
        >
          <p className="text-sm text-neo-muted">Se copia la última versión como un plan nuevo en borrador. El original no cambia.</p>
          <AppInput label="Nombre del nuevo plan" value={dupName} onChange={(e) => setDupName(e.target.value)} maxLength={120} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={dupTemplate} onChange={(e) => setDupTemplate(e.target.checked)} className="size-4" />
            Guardar la copia como plantilla
          </label>
          <div className="mt-1 flex justify-end gap-2">
            <AppButton variant="secondary" onClick={() => setDuplicating(false)}>Cancelar</AppButton>
            <AppButton type="submit" loading={duplicate.isPending} disabled={!dupName.trim()}>Duplicar</AppButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
