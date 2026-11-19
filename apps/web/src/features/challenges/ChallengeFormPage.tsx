import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import type { ChallengeDetailDto } from '@neo/shared-types';
import { createChallengeSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { coachRoutes } from '@/app/routes';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { coachChallengesApi, type ChallengeFormBody } from './challengesApi';

interface FormValues {
  name: string;
  category: string;
  description: string;
  goal: string;
  startDate: string;
  endDate: string;
  published: boolean;
}

const toSchemaInput = (v: FormValues) => ({
  name: v.name,
  category: v.category,
  description: v.description,
  goal: v.goal === '' ? NaN : Number(v.goal),
  startDate: v.startDate,
  endDate: v.endDate,
  published: v.published,
});

const toBody = (v: FormValues): ChallengeFormBody => ({
  name: v.name.trim(),
  category: v.category.trim(),
  description: v.description.trim() || null,
  goal: Number(v.goal),
  startDate: v.startDate,
  endDate: v.endDate,
  published: v.published,
});

const EMPTY: FormValues = { name: '', category: '', description: '', goal: '', startDate: '', endDate: '', published: false };

function ChallengeForm({ challenge }: { challenge?: ChallengeDetailDto }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  // Con participantes la meta y las fechas quedan fijas para no alterar su progreso.
  const locked = !!challenge && challenge.participants.length > 0;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: challenge
      ? { name: challenge.name, category: challenge.category, description: challenge.description ?? '', goal: String(challenge.goal), startDate: challenge.startDate, endDate: challenge.endDate, published: challenge.published }
      : EMPTY,
    resolver: zodFormResolver<FormValues>(createChallengeSchema, toSchemaInput),
  });

  const save = useMutation({
    mutationFn: (v: FormValues) => {
      const body = toBody(v);
      if (!challenge) return coachChallengesApi.create(body);
      if (locked) {
        const { goal: _g, startDate: _s, endDate: _e, ...rest } = body;
        return coachChallengesApi.update(challenge.id, rest);
      }
      return coachChallengesApi.update(challenge.id, body);
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['coach-challenges'] }), queryClient.invalidateQueries({ queryKey: ['coach-challenge'] })]);
      navigate(coachRoutes.challenges, { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.details.length) {
        for (const d of err.details) setError(d.field as keyof FormValues, { message: d.message });
      } else if (err instanceof ApiError && err.statusCode < 500) setFormError(err.message);
      else setFormError('No pudimos guardar el reto. Intenta de nuevo.');
    },
  });

  return (
    <AppCard>
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => { setFormError(null); save.mutate(v); })}>
        {formError && <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">{formError}</p>}
        {locked && (
          <p role="status" className="rounded-neo-input bg-neo-pink-light px-3 py-2 text-sm text-neo-primary-dark">
            Este reto ya tiene participantes: la meta y las fechas no se pueden cambiar.
          </p>
        )}
        <AppInput label="Nombre" error={errors.name?.message} {...register('name')} />
        <AppInput label="Categoría" placeholder="Ej.: ABS, Piernas, Constancia" error={errors.category?.message} {...register('category')} />
        <div className="flex flex-col gap-1">
          <label htmlFor="chf-description" className="text-sm font-medium">Descripción (opcional)</label>
          <textarea id="chf-description" rows={3} className="rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm" {...register('description')} />
          {errors.description && <p role="alert" className="text-xs text-red-700">{errors.description.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <AppInput label="Meta (sesiones)" type="number" min={1} max={365} inputMode="numeric" disabled={locked} error={errors.goal?.message} {...register('goal')} />
          <AppInput label="Inicio" type="date" disabled={locked} error={errors.startDate?.message} {...register('startDate')} />
          <AppInput label="Fin" type="date" disabled={locked} error={errors.endDate?.message} {...register('endDate')} />
        </div>
        <p className="text-xs text-neo-muted">Cuenta cada entrenamiento completado entre el inicio y el fin, después de que la usuaria se inscribe.</p>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--color-neo-primary)]" {...register('published')} />
          <span><strong>Publicado</strong> — al publicarlo, las usuarias reciben un aviso y pueden inscribirse</span>
        </label>
        <div className="flex justify-end gap-2">
          <Link to={coachRoutes.challenges}><AppButton variant="secondary">Cancelar</AppButton></Link>
          <AppButton type="submit" loading={save.isPending}>{challenge ? 'Guardar cambios' : 'Crear reto'}</AppButton>
        </div>
      </form>
    </AppCard>
  );
}

export function ChallengeFormPage() {
  const { id } = useParams();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['coach-challenge', id], queryFn: () => coachChallengesApi.get(id!), enabled: !!id });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link to={coachRoutes.challenges} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Retos
      </Link>
      <h1>{id ? 'Editar reto' : 'Crear reto'}</h1>
      {!id ? (
        <ChallengeForm />
      ) : isPending ? (
        <AppCard><SkeletonLoader lines={6} /></AppCard>
      ) : error ? (
        error instanceof ApiError && error.statusCode === 404 ? <ErrorState message="No encontramos ese reto." /> : <ErrorState message="No pudimos cargar el reto." onRetry={() => void refetch()} />
      ) : (
        <ChallengeForm key={data.id} challenge={data} />
      )}
    </div>
  );
}
