import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { ContentCategory, ContentType, type ContentDto } from '@neo/shared-types';
import { createContentSchema, extractYouTubeId } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { IMAGE_TYPES, MAX_IMAGE_MB, mediaApi } from '@/features/nutrition/nutritionApi';
import { YouTubePlayer } from '@/features/workouts/YouTubePlayer';
import { ApiError } from '@/services/apiClient';
import { coachRoutes } from '@/app/routes';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { options } from '@/features/workouts/labels';
import { contentApi, type ContentFormBody } from './contentApi';
import { CONTENT_CATEGORY_LABEL, CONTENT_TYPE_LABEL } from './labels';

interface FormValues {
  title: string;
  description: string;
  category: string;
  type: string;
  body: string;
  video: string;
  thumbnailAssetId: string;
  published: boolean;
}

const toSchemaInput = (v: FormValues) => ({
  title: v.title,
  description: v.description,
  category: v.category || undefined,
  type: v.type || undefined,
  // Solo cuenta lo que corresponde al tipo elegido.
  body: v.type === ContentType.ARTICLE ? v.body : null,
  video: v.type === ContentType.VIDEO ? v.video : null,
  thumbnailAssetId: v.thumbnailAssetId,
  published: v.published,
});

const toBody = (v: FormValues): ContentFormBody => ({
  title: v.title.trim(),
  description: v.description.trim() || null,
  category: v.category as ContentCategory,
  type: v.type as ContentType,
  body: v.type === ContentType.ARTICLE ? v.body.trim() : null,
  video: v.type === ContentType.VIDEO ? v.video.trim() : null,
  thumbnailAssetId: v.thumbnailAssetId || null,
  published: v.published,
});

const fromContent = (c: ContentDto): FormValues => ({
  title: c.title,
  description: c.description ?? '',
  category: c.category,
  type: c.type,
  body: c.body ?? '',
  video: c.videoId ? `https://youtu.be/${c.videoId}` : '',
  thumbnailAssetId: c.thumbnailAssetId ?? '',
  published: c.published,
});

const EMPTY: FormValues = { title: '', description: '', category: '', type: '', body: '', video: '', thumbnailAssetId: '', published: false };

function ContentForm({ content }: { content?: ContentDto }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: content ? fromContent(content) : EMPTY,
    resolver: zodFormResolver<FormValues>(createContentSchema, toSchemaInput),
  });

  const type = watch('type');
  const thumbnailId = watch('thumbnailAssetId');
  const videoId = extractYouTubeId(watch('video') ?? '');

  const save = useMutation({
    mutationFn: (v: FormValues) => (content ? contentApi.update(content.id, toBody(v)) : contentApi.create(toBody(v))),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['content'] });
      navigate(coachRoutes.content, { replace: true });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.details.length) {
        for (const d of err.details) setError(d.field as keyof FormValues, { message: d.message });
      } else if (err instanceof ApiError && err.statusCode < 500) setFormError(err.message);
      else setFormError('No pudimos guardar el contenido. Intenta de nuevo.');
    },
  });

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    if (!IMAGE_TYPES.includes(file.type)) return setImageError('Usa una imagen JPG, PNG o WebP.');
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setImageError(`La imagen supera ${MAX_IMAGE_MB} MB.`);
    setUploading(true);
    try {
      const asset = await mediaApi.uploadImage(file);
      setValue('thumbnailAssetId', asset.id, { shouldDirty: true });
    } catch (e) {
      setImageError(e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos subir la imagen. Intenta de nuevo.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

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
        {formError && <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">{formError}</p>}
        <AppInput label="Título" error={errors.title?.message} {...register('title')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <AppSelect label="Categoría" options={[{ value: '', label: 'Selecciona…' }, ...options(CONTENT_CATEGORY_LABEL)]} error={errors.category?.message} {...register('category')} />
          <AppSelect label="Tipo" options={[{ value: '', label: 'Selecciona…' }, ...options(CONTENT_TYPE_LABEL)]} error={errors.type?.message} {...register('type')} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="cf-description" className="text-sm font-medium">Resumen (opcional)</label>
          <textarea id="cf-description" rows={2} className={textarea} {...register('description')} />
          {errors.description && <p role="alert" className="text-xs text-red-700">{errors.description.message}</p>}
        </div>

        {type === ContentType.ARTICLE && (
          <div className="flex flex-col gap-1">
            <label htmlFor="cf-body" className="text-sm font-medium">Texto del artículo</label>
            <textarea id="cf-body" rows={10} className={textarea} {...register('body')} />
            {errors.body && <p role="alert" className="text-xs text-red-700">{errors.body.message}</p>}
          </div>
        )}
        {type === ContentType.VIDEO && (
          <>
            <AppInput
              label="Video de YouTube (enlace o ID)"
              placeholder="https://youtu.be/…"
              hint="Sube el video a YouTube como «No listado» y pega aquí su enlace."
              autoComplete="off"
              error={errors.video?.message}
              {...register('video')}
            />
            {videoId && <YouTubePlayer videoId={videoId} title="Vista previa del video" />}
          </>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Imagen de portada (opcional)</span>
          {thumbnailId && <img src={`/api/v1/media/${thumbnailId}`} alt="Portada del contenido" className="aspect-video w-full max-w-sm rounded-neo-card border border-neo-border object-cover" />}
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(',')} aria-label="Elegir imagen de portada" className="sr-only" onChange={(e) => void onPickImage(e.target.files?.[0])} />
            <AppButton variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()}>
              {thumbnailId ? 'Cambiar imagen' : 'Subir imagen'}
            </AppButton>
            {thumbnailId && <AppButton variant="ghost" onClick={() => setValue('thumbnailAssetId', '', { shouldDirty: true })}>Quitar</AppButton>}
          </div>
          <p className="text-xs text-neo-muted">JPG, PNG o WebP de hasta {MAX_IMAGE_MB} MB. En un video, si no subes imagen se usa la de YouTube.</p>
          {(imageError || errors.thumbnailAssetId) && <p role="alert" className="text-xs text-red-700">{imageError ?? errors.thumbnailAssetId?.message}</p>}
        </div>

        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--color-neo-primary)]" {...register('published')} />
          <span><strong>Publicado</strong> — las usuarias solo ven el contenido publicado</span>
        </label>
        <div className="flex justify-end gap-2">
          <Link to={coachRoutes.content}><AppButton variant="secondary">Cancelar</AppButton></Link>
          <AppButton type="submit" loading={save.isPending} disabled={uploading}>{content ? 'Guardar cambios' : 'Crear contenido'}</AppButton>
        </div>
      </form>
    </AppCard>
  );
}

export function ContentFormPage() {
  const { id } = useParams();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['content-item', id], queryFn: () => contentApi.get(id!), enabled: !!id });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link to={coachRoutes.content} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Contenido
      </Link>
      <h1>{id ? 'Editar contenido' : 'Crear contenido'}</h1>
      {!id ? (
        <ContentForm />
      ) : isPending ? (
        <AppCard><SkeletonLoader lines={6} /></AppCard>
      ) : error ? (
        error instanceof ApiError && error.statusCode === 404 ? <ErrorState message="No encontramos ese contenido." /> : <ErrorState message="No pudimos cargar el contenido." onRetry={() => void refetch()} />
      ) : (
        <ContentForm key={data.updatedAt} content={data} />
      )}
    </div>
  );
}
