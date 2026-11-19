import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import type { WorkoutCategory, WorkoutDifficulty, WorkoutDto } from '@neo/shared-types';
import { createWorkoutSchema, extractYouTubeId } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { coachRoutes } from '@/app/routes';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { CATEGORY_LABEL, DIFFICULTY_LABEL, options } from './labels';
import { workoutsApi, type WorkoutFormBody } from './workoutsApi';
import { YouTubePlayer } from './YouTubePlayer';

interface FormValues {
  title: string;
  description: string;
  durationMinutes: string;
  difficulty: string;
  category: string;
  video: string;
  equipment: string;
  tips: string;
  isPublished: boolean;
}

const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

const toSchemaInput = (v: FormValues) => ({
  title: v.title,
  description: v.description || null,
  durationMinutes: v.durationMinutes === '' ? NaN : Number(v.durationMinutes),
  difficulty: v.difficulty || undefined,
  category: v.category || undefined,
  video: v.video,
  equipment: lines(v.equipment),
  tips: lines(v.tips),
  isPublished: v.isPublished,
});

const toBody = (v: FormValues): WorkoutFormBody => ({
  title: v.title.trim(),
  description: v.description.trim() || null,
  durationMinutes: Number(v.durationMinutes),
  difficulty: v.difficulty as WorkoutDifficulty,
  category: v.category as WorkoutCategory,
  video: v.video.trim(),
  equipment: lines(v.equipment),
  tips: lines(v.tips),
  isPublished: v.isPublished,
});

const fromWorkout = (w: WorkoutDto): FormValues => ({
  title: w.title,
  description: w.description ?? '',
  durationMinutes: String(w.durationMinutes),
  difficulty: w.difficulty,
  category: w.category,
  video: `https://youtu.be/${w.videoId}`,
  equipment: w.equipment.join('\n'),
  tips: w.tips.join('\n'),
  isPublished: w.isPublished,
});

const EMPTY: FormValues = { title: '', description: '', durationMinutes: '', difficulty: '', category: '', video: '', equipment: '', tips: '', isPublished: false };

function WorkoutForm({ workout }: { workout?: WorkoutDto }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: workout ? fromWorkout(workout) : EMPTY,
    resolver: zodFormResolver<FormValues>(createWorkoutSchema, toSchemaInput),
  });

  const videoId = extractYouTubeId(watch('video') ?? '');

  const save = useMutation({
    mutationFn: (v: FormValues) => (workout ? workoutsApi.update(workout.id, toBody(v)) : workoutsApi.create(toBody(v))),
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['workouts'] }), queryClient.invalidateQueries({ queryKey: ['workout'] })]);
      navigate(coachRoutes.workouts, { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.details.length) {
        for (const d of err.details) setError(d.field as keyof FormValues, { message: d.message });
      } else setFormError('No pudimos guardar la clase. Intenta de nuevo.');
    },
  });

  const textarea = 'rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm';

  return (
    <AppCard>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) => {
          setFormError(null);
          save.mutate(v);
        })}
      >
        {formError && (
          <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">
            {formError}
          </p>
        )}
        <AppInput label="Título" error={errors.title?.message} {...register('title')} />
        <div className="flex flex-col gap-1">
          <label htmlFor="wf-description" className="text-sm font-medium">
            Descripción (opcional)
          </label>
          <textarea id="wf-description" rows={3} className={textarea} {...register('description')} />
          {errors.description && (
            <p role="alert" className="text-xs text-red-700">
              {errors.description.message}
            </p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <AppInput label="Duración (minutos)" type="number" min={5} max={240} inputMode="numeric" error={errors.durationMinutes?.message} {...register('durationMinutes')} />
          <AppSelect label="Nivel" options={[{ value: '', label: 'Selecciona…' }, ...options(DIFFICULTY_LABEL)]} error={errors.difficulty?.message} {...register('difficulty')} />
          <AppSelect label="Categoría" options={[{ value: '', label: 'Selecciona…' }, ...options(CATEGORY_LABEL)]} error={errors.category?.message} {...register('category')} />
        </div>
        <AppInput
          label="Video de YouTube (enlace o ID)"
          placeholder="https://youtu.be/…"
          hint="Sube el video a YouTube como «No listado» y pega aquí su enlace."
          autoComplete="off"
          error={errors.video?.message}
          {...register('video')}
        />
        {videoId && <YouTubePlayer videoId={videoId} title="Vista previa del video" />}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="wf-equipment" className="text-sm font-medium">
              Materiales (uno por línea)
            </label>
            <textarea id="wf-equipment" rows={4} className={textarea} {...register('equipment')} />
            {errors.equipment && (
              <p role="alert" className="text-xs text-red-700">
                {errors.equipment.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="wf-tips" className="text-sm font-medium">
              Tips (uno por línea)
            </label>
            <textarea id="wf-tips" rows={4} className={textarea} {...register('tips')} />
            {errors.tips && (
              <p role="alert" className="text-xs text-red-700">
                {errors.tips.message}
              </p>
            )}
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--color-neo-primary)]" {...register('isPublished')} />
          <span>
            <strong>Publicada</strong> — solo las clases publicadas se pueden asignar
          </span>
        </label>
        <div className="flex justify-end gap-2">
          <Link to={coachRoutes.workouts}>
            <AppButton variant="secondary">Cancelar</AppButton>
          </Link>
          <AppButton type="submit" loading={save.isPending}>
            {workout ? 'Guardar cambios' : 'Crear clase'}
          </AppButton>
        </div>
      </form>
    </AppCard>
  );
}

export function WorkoutFormPage() {
  const { id } = useParams();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['workout', id],
    queryFn: () => workoutsApi.get(id!),
    enabled: !!id,
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link to={coachRoutes.workouts} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Entrenamientos
      </Link>
      <h1>{id ? 'Editar clase' : 'Crear clase'}</h1>
      {!id ? (
        <WorkoutForm />
      ) : isPending ? (
        <AppCard>
          <SkeletonLoader lines={6} />
        </AppCard>
      ) : error ? (
        error instanceof ApiError && error.statusCode === 404 ? (
          <ErrorState message="No encontramos esa clase." />
        ) : (
          <ErrorState message="No pudimos cargar la clase." onRetry={() => void refetch()} />
        )
      ) : (
        <WorkoutForm key={data.updatedAt} workout={data} />
      )}
    </div>
  );
}
