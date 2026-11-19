import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Trash2 } from 'lucide-react';
import { MealType, type MealLogDto, type NutritionMealDto } from '@neo/shared-types';
import { createMealLogSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { Modal } from '@/components/ui/Modal';
import { MEAL_TYPE_LABEL, MEAL_TYPE_ORDER, options } from '@/features/nutrition/labels';
import { IMAGE_TYPES, MAX_IMAGE_MB, mealLogsApi, mediaApi } from '@/features/nutrition/nutritionApi';
import { ApiError } from '@/services/apiClient';
import { dayLabel } from '@/utils/calendar';

export interface MealLogModalProps {
  date: string;
  mealType: MealType;
  /** Comida del plan con la que se relaciona (opcional: se puede comer fuera del plan). */
  planned?: NutritionMealDto | null;
  log?: MealLogDto | null;
  onClose: () => void;
}

interface Photo { id: string; url: string }

/** HU-22 · U06: registrar lo realmente consumido con foto y descripción; guardar borrador o enviar a la Coach. */
export function MealLogModal({ date, mealType, planned, log, onClose }: MealLogModalProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<MealType>(log?.mealType ?? mealType);
  const [description, setDescription] = useState(log?.description ?? '');
  const [time, setTime] = useState(log?.time ?? '');
  const [photo, setPhoto] = useState<Photo | null>(log?.imageAssetId && log.imageUrl ? { id: log.imageAssetId, url: log.imageUrl } : null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => mediaApi.uploadImage(file),
    onSuccess: (asset) => {
      setPhoto({ id: asset.id, url: asset.url });
      setPhotoError(null);
    },
    onError: (e) => setPhotoError(e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos subir la foto. Intenta de nuevo.'),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    // Validación previa para ahorrar el viaje; el servidor vuelve a validar el contenido real (§9.2).
    if (!IMAGE_TYPES.includes(file.type)) return setPhotoError('Usa una imagen JPG, PNG o WebP.');
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setPhotoError(`La foto pesa más de ${MAX_IMAGE_MB} MB.`);
    setPhotoError(null);
    upload.mutate(file);
  };

  const save = useMutation({
    mutationFn: async (send: boolean) => {
      const body = {
        mealType: type,
        description: description.trim(),
        date,
        time: time || null,
        plannedMealId: log ? log.plannedMealId : (planned?.id ?? null),
        imageAssetId: photo?.id ?? null,
      };
      const parsed = createMealLogSchema.safeParse(body);
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
        return null;
      }
      if (send && !body.description) {
        setFieldError('Agrega una descripción antes de enviar a tu coach');
        return null;
      }
      setFieldError(null);
      const saved = log ? await mealLogsApi.update(log.id, body) : await mealLogsApi.create(body);
      if (send) await mealLogsApi.submit(saved.id);
      return saved;
    },
    onSuccess: async (saved) => {
      if (!saved) return;
      await queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
      onClose();
    },
    onError: (e) => {
      void queryClient.invalidateQueries({ queryKey: ['meal-logs'] });
      setError(e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos guardar. Intenta de nuevo.');
    },
  });

  const busy = save.isPending || upload.isPending;
  return (
    <Modal open title={`${log ? 'Editar' : 'Registrar'} · ${MEAL_TYPE_LABEL[type]}`} onClose={onClose}>
      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          save.mutate(false);
        }}
      >
        <p className="text-sm text-neo-muted">{dayLabel(date)}</p>
        {planned && (
          <p className="rounded-neo-input bg-neo-neutral p-2 text-sm">
            En tu plan: <strong>{planned.title}</strong>
            {planned.scheduledTime ? ` · ${planned.scheduledTime}` : ''}. Anota lo que realmente comiste, aunque sea diferente.
          </p>
        )}

        {!log && (
          <AppSelect label="Tipo de comida" value={type} options={options(MEAL_TYPE_LABEL, MEAL_TYPE_ORDER)} onChange={(e) => setType(e.target.value as MealType)} />
        )}
        <AppInput label="Hora (opcional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} hint="Si la dejas vacía usamos la hora actual." />

        <div className="flex flex-col gap-1">
          <label htmlFor="meal-description" className="text-sm font-medium">¿Qué comiste?</label>
          <textarea
            id="meal-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            aria-invalid={fieldError ? true : undefined}
            placeholder="Ej.: avena con banano y frutos rojos"
            className="rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Foto (opcional)</span>
          {photo ? (
            <div className="flex items-center gap-3">
              <img src={photo.url} alt="Foto de tu comida" className="size-24 rounded-neo-input object-cover" />
              <AppButton variant="ghost" onClick={() => setPhoto(null)}>
                <Trash2 className="size-4" aria-hidden="true" /> Quitar foto
              </AppButton>
            </div>
          ) : (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_TYPES.join(',')}
                aria-label="Elegir foto de la comida"
                className="sr-only"
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <AppButton variant="secondary" loading={upload.isPending} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden="true" /> Agregar foto
              </AppButton>
              <p className="mt-1 text-xs text-neo-muted">JPG, PNG o WebP, hasta {MAX_IMAGE_MB} MB. Solo tú y tu coach la verán.</p>
            </div>
          )}
          {photoError && <p role="alert" className="text-xs text-red-700">{photoError}</p>}
        </div>

        {fieldError && <p role="alert" className="text-sm text-red-700">{fieldError}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        <div className="mt-1 flex flex-wrap justify-end gap-2">
          <AppButton variant="secondary" onClick={onClose}>Cancelar</AppButton>
          <AppButton type="submit" variant="secondary" disabled={busy}>Guardar borrador</AppButton>
          <AppButton loading={save.isPending && save.variables === true} disabled={busy} onClick={() => { setError(null); save.mutate(true); }}>
            Enviar a mi coach
          </AppButton>
        </div>
      </form>
    </Modal>
  );
}
