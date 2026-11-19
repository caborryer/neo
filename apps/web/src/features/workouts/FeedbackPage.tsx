import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star } from 'lucide-react';
import { FeedbackCompletion } from '@neo/shared-types';
import { createFeedbackSchema, type CreateFeedbackInput } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { userRoutes } from '@/app/routes';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { cn } from '@/utils/cn';
import { assignmentsApi, sessionsApi } from './workoutsApi';

interface FormValues {
  completed: string;
  completionPercentage: string;
  notCompletedReason: string;
  feelingRating: string;
  feelingDescription: string;
  ateBeforeWorkout: string;
  preWorkoutMeal: string;
}

const toSchemaInput = (v: FormValues) => ({
  completed: v.completed || undefined,
  completionPercentage: v.completionPercentage === '' ? null : Number(v.completionPercentage),
  notCompletedReason: v.notCompletedReason || null,
  feelingRating: v.feelingRating === '' ? undefined : Number(v.feelingRating),
  feelingDescription: v.feelingDescription || null,
  ateBeforeWorkout: v.ateBeforeWorkout === '' ? undefined : v.ateBeforeWorkout === 'yes',
  preWorkoutMeal: v.preWorkoutMeal || null,
});

const COMPLETION: { value: FeedbackCompletion; label: string }[] = [
  { value: FeedbackCompletion.YES, label: 'Sí' },
  { value: FeedbackCompletion.PARTIAL, label: 'Parcial' },
  { value: FeedbackCompletion.NO, label: 'No' },
];

const choice = 'flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-neo-button border border-neo-border text-sm font-medium has-[:checked]:border-neo-primary has-[:checked]:bg-neo-pink-light has-[:checked]:text-neo-primary-dark has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-neo-green';

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-xs text-red-700">
      {message}
    </p>
  ) : null;
}

/** U04 · HU-20: formulario post-entrenamiento con campos condicionales. */
export function FeedbackPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const { data: a, isPending, error: loadError, refetch } = useQuery({ queryKey: ['assignment', id], queryFn: () => assignmentsApi.get(id) });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { completed: '', completionPercentage: '', notCompletedReason: '', feelingRating: '', feelingDescription: '', ateBeforeWorkout: '', preWorkoutMeal: '' },
    resolver: zodFormResolver<FormValues>(createFeedbackSchema, toSchemaInput),
  });
  const completed = watch('completed');
  const ate = watch('ateBeforeWorkout');
  const rating = Number(watch('feelingRating') || 0);

  const send = useMutation({
    mutationFn: (v: FormValues) => sessionsApi.feedback(a!.session!.id, toSchemaInput(v) as CreateFeedbackInput),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assignment', id] }),
        queryClient.invalidateQueries({ queryKey: ['assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['sessions'] }),
      ]);
      setDone(true);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.statusCode === 409) setDone(true);
      else if (err instanceof ApiError && err.details.length) {
        for (const d of err.details) setError(d.field as keyof FormValues, { message: d.message });
      } else setFormError('No pudimos guardar tu respuesta. Intenta de nuevo.');
    },
  });

  if (isPending) {
    return (
      <AppCard>
        <SkeletonLoader lines={6} />
      </AppCard>
    );
  }
  if (loadError) return <ErrorState message="No pudimos cargar el entrenamiento." onRetry={() => void refetch()} />;
  // Sin sesión registrada no hay a qué asociar la retroalimentación.
  if (!a.session) return <Navigate to={userRoutes.workout(id)} replace />;

  if (done || a.session.hasFeedback) {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <AppCard>
          <h1 className="text-2xl">¡Gracias!</h1>
          <p role="status" className="mt-2 text-sm text-neo-muted">
            Guardamos tu retroalimentación de {a.workout.title}. Tu Coach la verá.
          </p>
          <Link to={userRoutes.calendar} className="mt-4 inline-block">
            <AppButton>Volver al calendario</AppButton>
          </Link>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Link to={userRoutes.workout(id)} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> {a.workout.title}
      </Link>
      <h1>¿Cómo te fue?</h1>
      <AppCard>
        <form
          noValidate
          className="flex flex-col gap-6"
          onSubmit={handleSubmit((v) => {
            setFormError(null);
            send.mutate(v);
          })}
        >
          {formError && (
            <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">
              {formError}
            </p>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">¿Completaste la sesión?</legend>
            <div className="flex gap-2">
              {COMPLETION.map((o) => (
                <label key={o.value} className={choice}>
                  <input type="radio" value={o.value} className="sr-only" {...register('completed')} />
                  {o.label}
                </label>
              ))}
            </div>
            <FieldError message={errors.completed?.message} />
          </fieldset>

          {completed === FeedbackCompletion.PARTIAL && (
            <AppInput
              label="¿Qué porcentaje completaste?"
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              hint="Entre 1 y 99."
              error={errors.completionPercentage?.message}
              {...register('completionPercentage')}
            />
          )}
          {completed === FeedbackCompletion.NO && (
            <div className="flex flex-col gap-1">
              <label htmlFor="fb-reason" className="text-sm font-medium">
                ¿Por qué no la completaste?
              </label>
              <textarea id="fb-reason" rows={3} className="rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm" {...register('notCompletedReason')} />
              <FieldError message={errors.notCompletedReason?.message} />
            </div>
          )}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">¿Cómo te sentiste?</legend>
            <div className="flex gap-1" role="radiogroup">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer rounded p-1 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-neo-green">
                  <input type="radio" value={String(n)} className="sr-only" aria-label={`${n} de 5`} {...register('feelingRating')} />
                  <Star className={cn('size-8', n <= rating ? 'fill-neo-warning text-neo-warning' : 'text-neo-border')} aria-hidden="true" />
                </label>
              ))}
            </div>
            <FieldError message={errors.feelingRating?.message} />
          </fieldset>

          <div className="flex flex-col gap-1">
            <label htmlFor="fb-feeling" className="text-sm font-medium">
              Cuéntanos más (opcional)
            </label>
            <textarea id="fb-feeling" rows={3} className="rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm" {...register('feelingDescription')} />
            <FieldError message={errors.feelingDescription?.message} />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">¿Comiste antes de entrenar?</legend>
            <div className="flex gap-2">
              <label className={choice}>
                <input type="radio" value="yes" className="sr-only" {...register('ateBeforeWorkout')} />
                Sí
              </label>
              <label className={choice}>
                <input type="radio" value="no" className="sr-only" {...register('ateBeforeWorkout')} />
                No
              </label>
            </div>
            <FieldError message={errors.ateBeforeWorkout?.message} />
          </fieldset>
          {ate === 'yes' && <AppInput label="¿Qué comiste?" error={errors.preWorkoutMeal?.message} {...register('preWorkoutMeal')} />}

          <AppButton type="submit" fullWidth loading={send.isPending}>
            Guardar
          </AppButton>
        </form>
      </AppCard>
    </div>
  );
}
