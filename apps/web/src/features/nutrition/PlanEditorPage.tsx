import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Plus, Trash2 } from 'lucide-react';
import { DayOfWeek, FoodUnit, MealType, type NutritionVersionDto } from '@neo/shared-types';
import { createNutritionPlanSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { coachRoutes } from '@/app/routes';
import { cn } from '@/utils/cn';
import { DAY_LABEL, DAY_ORDER, DAY_SHORT, FOOD_UNIT_LABEL, MEAL_TYPE_LABEL, MEAL_TYPE_ORDER, options } from './labels';
import { plansApi } from './nutritionApi';

// ── Estado local del editor ──────────────────────────────────────────────

interface FoodRow { key: string; name: string; quantity: string; unit: FoodUnit; notes: string }
interface MealRow { key: string; mealType: MealType; title: string; scheduledTime: string; instructions: string; foods: FoodRow[] }
type DaysState = Record<DayOfWeek, MealRow[]>;

let seq = 0;
const uid = () => `k${++seq}`;
const emptyDays = (): DaysState => Object.fromEntries(DAY_ORDER.map((d) => [d, [] as MealRow[]])) as DaysState;
const newFood = (): FoodRow => ({ key: uid(), name: '', quantity: '', unit: FoodUnit.GRAMS, notes: '' });
const newMeal = (mealType: MealType = MealType.BREAKFAST): MealRow => ({
  key: uid(), mealType, title: MEAL_TYPE_LABEL[mealType], scheduledTime: '', instructions: '', foods: [newFood()],
});

function fromVersion(v: NutritionVersionDto): DaysState {
  const days = emptyDays();
  for (const d of v.days) {
    days[d.dayName] = d.meals.map((m) => ({
      key: uid(), mealType: m.mealType, title: m.title, scheduledTime: m.scheduledTime ?? '', instructions: m.instructions ?? '',
      foods: m.foods.map((f) => ({ key: uid(), name: f.name, quantity: String(f.quantity), unit: f.unit, notes: f.notes ?? '' })),
    }));
  }
  return days;
}

const toNumber = (s: string): number => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

/** Solo viajan los días con comidas; los textos vacíos se envían como null. */
function toPayload(days: DaysState) {
  return DAY_ORDER.filter((d) => days[d].length > 0).map((dayName) => ({
    dayName,
    meals: days[dayName].map((m) => ({
      mealType: m.mealType,
      title: m.title,
      scheduledTime: m.scheduledTime || null,
      instructions: m.instructions || null,
      foods: m.foods.map((f) => ({ name: f.name, quantity: toNumber(f.quantity), unit: f.unit, notes: f.notes || null })),
    })),
  }));
}

/** "days.0.meals.1.foods.2.name" → "Lunes · Almuerzo · Alimento 3". */
function describePath(path: PropertyKey[], payload: ReturnType<typeof toPayload>): string {
  const [root, di, , mi, , fi] = path;
  if (root !== 'days' || typeof di !== 'number') return '';
  const day = payload[di];
  const parts = [day ? DAY_LABEL[day.dayName] : 'Día'];
  if (typeof mi === 'number') parts.push(day?.meals[mi]?.title || `Comida ${mi + 1}`);
  if (typeof fi === 'number') parts.push(`Alimento ${fi + 1}`);
  return parts.join(' · ');
}

const DAY_TABS_ID = 'plan-day-tabs';

/** HU-11 · C06: constructor de planes (crear plan nuevo o editar el borrador de la versión actual). */
export function PlanEditorPage() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [days, setDays] = useState<DaysState>(emptyDays);
  const [selected, setSelected] = useState<DayOfWeek>(DayOfWeek.MONDAY);
  const [problems, setProblems] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const plan = useQuery({ queryKey: ['nutrition-plan', id], queryFn: () => plansApi.get(id!), enabled: editing });
  const draft = plan.data?.versions.find((v) => v.publishedAt === null);
  const version = useQuery({
    queryKey: ['nutrition-version', id, draft?.id],
    queryFn: () => plansApi.getVersion(id!, draft!.id),
    enabled: editing && !!draft,
  });

  // Carga única de los datos del servidor en el formulario (después, el estado local manda).
  useEffect(() => {
    if (loaded || !plan.data || !version.data) return;
    setName(plan.data.name);
    setDescription(plan.data.description ?? '');
    setIsTemplate(plan.data.isTemplate);
    setNotes(version.data.notes ?? '');
    setDays(fromVersion(version.data));
    setLoaded(true);
  }, [loaded, plan.data, version.data]);

  const newVersion = useMutation({
    mutationFn: () => plansApi.createVersion(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nutrition-plan', id] }),
    onError: (e) => setError(e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos crear la versión.'),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), description: description.trim() || null, isTemplate, notes: notes.trim() || null, days: toPayload(days) };
      const parsed = createNutritionPlanSchema.safeParse(payload);
      if (!parsed.success) {
        setProblems(parsed.error.issues.map((i) => [describePath(i.path, payload.days), i.message].filter(Boolean).join(': ')));
        return null;
      }
      setProblems([]);
      if (!editing) return plansApi.create(payload);
      await plansApi.update(id!, { name: payload.name, description: payload.description, isTemplate });
      await plansApi.saveDraft(id!, draft!.id, { notes: payload.notes, days: payload.days });
      return plansApi.get(id!);
    },
    onSuccess: async (result) => {
      if (!result) return;
      await queryClient.invalidateQueries({ queryKey: ['nutrition-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['nutrition-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['nutrition-version'] });
      navigate(coachRoutes.nutritionPlan(result.id));
    },
    onError: (e) => setError(e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos guardar. Intenta de nuevo.'),
  });

  // ── Edición de comidas y alimentos ──
  const setMeals = (day: DayOfWeek, fn: (meals: MealRow[]) => MealRow[]) => setDays((s) => ({ ...s, [day]: fn(s[day]) }));
  const patchMeal = (mealKey: string, patch: Partial<MealRow>) => setMeals(selected, (ms) => ms.map((m) => (m.key === mealKey ? { ...m, ...patch } : m)));
  const patchFood = (mealKey: string, foodKey: string, patch: Partial<FoodRow>) =>
    setMeals(selected, (ms) => ms.map((m) => (m.key === mealKey ? { ...m, foods: m.foods.map((f) => (f.key === foodKey ? { ...f, ...patch } : f)) } : m)));
  const copyDayTo = (target: DayOfWeek) =>
    setDays((s) => ({
      ...s,
      [target]: s[selected].map((m) => ({ ...m, key: uid(), foods: m.foods.map((f) => ({ ...f, key: uid() })) })),
    }));

  const mealCount = useMemo(() => DAY_ORDER.reduce((n, d) => n + days[d].length, 0), [days]);
  const back = editing ? coachRoutes.nutritionPlan(id) : coachRoutes.nutritionPlans;

  if (editing && plan.isPending) return <AppCard><SkeletonLoader lines={6} /></AppCard>;
  if (editing && plan.isError) return <ErrorState message="No pudimos cargar el plan." onRetry={() => void plan.refetch()} />;

  // La última versión está publicada: es inmutable, así que hay que abrir una nueva.
  if (editing && plan.data && !draft) {
    return (
      <div className="flex flex-col gap-4">
        <Link to={back} className="inline-flex items-center gap-1 text-sm text-neo-primary-dark">
          <ArrowLeft className="size-4" aria-hidden="true" /> Volver al plan
        </Link>
        <AppCard>
          <h1 className="text-xl">Esta versión ya está publicada</h1>
          <p className="mt-2 text-sm text-neo-muted">
            Las versiones publicadas no se modifican para conservar el historial de lo que recibió cada usuaria. Crea una nueva versión (copia de la última) y edítala.
          </p>
          {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
          <AppButton className="mt-4" loading={newVersion.isPending} onClick={() => newVersion.mutate()}>
            Crear nueva versión
          </AppButton>
        </AppCard>
      </div>
    );
  }
  if (editing && (version.isPending || !loaded)) {
    return version.isError ? <ErrorState message="No pudimos cargar el borrador." onRetry={() => void version.refetch()} /> : <AppCard><SkeletonLoader lines={6} /></AppCard>;
  }

  const meals = days[selected];
  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save.mutate();
      }}
    >
      <Link to={back} className="inline-flex items-center gap-1 text-sm text-neo-primary-dark">
        <ArrowLeft className="size-4" aria-hidden="true" /> {editing ? 'Volver al plan' : 'Volver a los planes'}
      </Link>
      <h1>{editing ? `Editar borrador · versión ${draft?.versionNumber}` : 'Crear plan nutricional'}</h1>

      <AppCard>
        <h2 className="mb-3 text-base">1. Información general</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <AppInput label="Nombre del plan" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
          <label className="flex min-h-11 items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={isTemplate} onChange={(e) => setIsTemplate(e.target.checked)} className="size-4" />
            Guardar como plantilla reutilizable
          </label>
          <div className="sm:col-span-2">
            <AppInput label="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="plan-notes" className="text-sm font-medium">Observaciones generales (opcional)</label>
            <textarea
              id="plan-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              placeholder="Hidratación, suplementos, recomendaciones para toda la semana…"
              className="rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm"
            />
          </div>
        </div>
      </AppCard>

      <AppCard>
        <h2 className="mb-1 text-base">2. Días, comidas y alimentos</h2>
        <p className="mb-3 text-sm text-neo-muted">Elige un día y agrega sus comidas. Los días sin comidas no se incluyen en el plan.</p>

        <div role="tablist" id={DAY_TABS_ID} aria-label="Días de la semana" className="flex gap-1 overflow-x-auto pb-1">
          {DAY_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={selected === d}
              aria-label={`${DAY_LABEL[d]}, ${days[d].length} comidas`}
              onClick={() => setSelected(d)}
              className={cn('min-h-11 shrink-0 rounded-neo-button px-3 text-sm font-medium', selected === d ? 'bg-neo-primary text-white' : 'bg-neo-neutral hover:bg-neo-border')}
            >
              {DAY_SHORT[d]}
              {days[d].length > 0 && <span className="ml-1 text-xs opacity-80">({days[d].length})</span>}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4" role="tabpanel" aria-label={DAY_LABEL[selected]}>
          {meals.length === 0 && <p className="rounded-neo-card border border-dashed border-neo-border p-4 text-sm text-neo-muted">Aún no hay comidas el {DAY_LABEL[selected].toLowerCase()}.</p>}

          {meals.map((m, mi) => (
            <fieldset key={m.key} className="rounded-neo-card border border-neo-border p-3">
              <legend className="px-1 text-sm font-semibold">Comida {mi + 1}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <AppSelect
                  label="Tipo"
                  value={m.mealType}
                  options={options(MEAL_TYPE_LABEL, MEAL_TYPE_ORDER)}
                  onChange={(e) => {
                    const mealType = e.target.value as MealType;
                    // Si el título era el del tipo anterior, se actualiza solo.
                    patchMeal(m.key, { mealType, title: m.title === MEAL_TYPE_LABEL[m.mealType] ? MEAL_TYPE_LABEL[mealType] : m.title });
                  }}
                />
                <AppInput label="Título" value={m.title} onChange={(e) => patchMeal(m.key, { title: e.target.value })} maxLength={100} />
                <AppInput label="Hora sugerida" type="time" value={m.scheduledTime} onChange={(e) => patchMeal(m.key, { scheduledTime: e.target.value })} />
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <p className="text-sm font-medium">Alimentos</p>
                {m.foods.map((f, fi) => (
                  <div key={f.key} className="grid grid-cols-[1fr_5.5rem_7rem_auto] items-end gap-2 sm:grid-cols-[2fr_6rem_8rem_2fr_auto]">
                    <div className="col-span-4 sm:col-span-1">
                      <AppInput label={`Alimento ${fi + 1}`} value={f.name} onChange={(e) => patchFood(m.key, f.key, { name: e.target.value })} maxLength={100} />
                    </div>
                    <AppInput label="Cantidad" inputMode="decimal" value={f.quantity} onChange={(e) => patchFood(m.key, f.key, { quantity: e.target.value })} />
                    <AppSelect label="Unidad" value={f.unit} options={options(FOOD_UNIT_LABEL)} onChange={(e) => patchFood(m.key, f.key, { unit: e.target.value as FoodUnit })} />
                    <div className="col-span-3 sm:col-span-1">
                      <AppInput label="Nota (opcional)" value={f.notes} onChange={(e) => patchFood(m.key, f.key, { notes: e.target.value })} maxLength={300} />
                    </div>
                    <AppButton
                      variant="ghost"
                      aria-label={`Quitar alimento ${fi + 1} de ${m.title || `comida ${mi + 1}`}`}
                      onClick={() => patchMeal(m.key, { foods: m.foods.filter((x) => x.key !== f.key) })}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </AppButton>
                  </div>
                ))}
                <div>
                  <AppButton variant="secondary" onClick={() => patchMeal(m.key, { foods: [...m.foods, newFood()] })} aria-label={`Agregar alimento a ${m.title || `comida ${mi + 1}`}`}>
                    <Plus className="size-4" aria-hidden="true" /> Agregar alimento
                  </AppButton>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1">
                <label htmlFor={`instr-${m.key}`} className="text-sm font-medium">Recomendaciones (opcional)</label>
                <textarea
                  id={`instr-${m.key}`}
                  rows={2}
                  value={m.instructions}
                  onChange={(e) => patchMeal(m.key, { instructions: e.target.value })}
                  maxLength={1000}
                  className="rounded-neo-input border border-neo-border bg-neo-surface p-3 text-sm"
                />
              </div>
              <div className="mt-2 text-right">
                <AppButton variant="ghost" onClick={() => setMeals(selected, (ms) => ms.filter((x) => x.key !== m.key))} aria-label={`Quitar comida ${mi + 1}`}>
                  <Trash2 className="size-4" aria-hidden="true" /> Quitar comida
                </AppButton>
              </div>
            </fieldset>
          ))}

          <div className="flex flex-wrap items-center gap-3">
            <AppButton variant="secondary" onClick={() => setMeals(selected, (ms) => [...ms, newMeal(MEAL_TYPE_ORDER[Math.min(ms.length, 4)])])}>
              <Plus className="size-4" aria-hidden="true" /> Agregar comida
            </AppButton>
            {meals.length > 0 && (
              <div className="flex items-center gap-2">
                <Copy className="size-4 text-neo-muted" aria-hidden="true" />
                <select
                  aria-label={`Copiar el ${DAY_LABEL[selected].toLowerCase()} a otro día`}
                  value=""
                  onChange={(e) => e.target.value && copyDayTo(e.target.value as DayOfWeek)}
                  className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm"
                >
                  <option value="">Copiar este día a…</option>
                  {DAY_ORDER.filter((d) => d !== selected).map((d) => (
                    <option key={d} value={d}>{DAY_LABEL[d]}{days[d].length ? ' (reemplaza sus comidas)' : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </AppCard>

      {problems.length > 0 && (
        <div role="alert" className="rounded-neo-card border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Revisa estos puntos antes de guardar:</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neo-muted">{mealCount} {mealCount === 1 ? 'comida' : 'comidas'} en total. Se guarda como borrador; publícalo desde el detalle del plan.</p>
        <div className="flex gap-2">
          <Link to={back}><AppButton variant="secondary">Cancelar</AppButton></Link>
          <AppButton type="submit" loading={save.isPending}>{editing ? 'Guardar borrador' : 'Crear plan'}</AppButton>
        </div>
      </div>
    </form>
  );
}
