import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RiskSettingsDto } from '@neo/shared-types';
import { DEFAULT_RISK_SETTINGS, riskSettingsSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { PasswordCard, ProfileCard } from '@/features/profile/ProfileSections';
import { ApiError } from '@/services/apiClient';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { statsApi } from './statsApi';

interface RiskForm {
  inactivityDays: string;
  consecutiveMissed: string;
  noFoodLogDays: string;
  adherenceDropPoints: string;
}
const toForm = (s: RiskSettingsDto): RiskForm => ({
  inactivityDays: String(s.inactivityDays),
  consecutiveMissed: String(s.consecutiveMissed),
  noFoodLogDays: String(s.noFoodLogDays),
  adherenceDropPoints: String(s.adherenceDropPoints),
});
const toInput = (v: RiskForm) => ({
  inactivityDays: v.inactivityDays === '' ? NaN : Number(v.inactivityDays),
  consecutiveMissed: v.consecutiveMissed === '' ? NaN : Number(v.consecutiveMissed),
  noFoodLogDays: v.noFoodLogDays === '' ? NaN : Number(v.noFoodLogDays),
  adherenceDropPoints: v.adherenceDropPoints === '' ? NaN : Number(v.adherenceDropPoints),
});

function RiskForm({ settings }: { settings: RiskSettingsDto }) {
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<RiskForm>({ defaultValues: toForm(settings), resolver: zodFormResolver<RiskForm>(riskSettingsSchema, toInput) });

  const save = useMutation({
    mutationFn: (v: RiskForm) => statsApi.updateRisk(riskSettingsSchema.parse(toInput(v))),
    onSuccess: (s) => {
      reset(toForm(s));
      void queryClient.invalidateQueries({ queryKey: ['coach-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['user-stats'] });
      setMsg({ ok: true, text: 'Umbrales guardados. Las alertas se recalculan con los nuevos valores.' });
    },
    onError: (e) => setMsg({ ok: false, text: e instanceof ApiError && e.statusCode < 500 ? e.message : 'No pudimos guardar los umbrales.' }),
  });

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => { setMsg(null); save.mutate(v); })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <AppInput label="Días sin entrenar" type="number" min={3} max={30} hint="Alerta de inactividad." error={errors.inactivityDays?.message} {...register('inactivityDays')} />
        <AppInput label="Entrenamientos seguidos sin completar" type="number" min={2} max={10} hint="Alerta de baja adherencia." error={errors.consecutiveMissed?.message} {...register('consecutiveMissed')} />
        <AppInput label="Días sin registrar comidas" type="number" min={2} max={30} hint="Solo con plan nutricional vigente." error={errors.noFoodLogDays?.message} {...register('noFoodLogDays')} />
        <AppInput label="Caída de adherencia (puntos)" type="number" min={10} max={80} hint="Últimas 2 semanas frente a las 2 anteriores." error={errors.adherenceDropPoints?.message} {...register('adherenceDropPoints')} />
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-neo-green' : 'text-sm text-red-700'}>{msg.text}</p>}
      <div className="flex flex-wrap justify-between gap-2">
        <AppButton variant="ghost" onClick={() => reset(toForm(DEFAULT_RISK_SETTINGS), { keepDefaultValues: true })}>Restablecer valores por defecto</AppButton>
        <AppButton type="submit" disabled={!isDirty} loading={save.isPending}>Guardar umbrales</AppButton>
      </div>
    </form>
  );
}

/** HU-15 · C10: umbrales de las alertas de riesgo, perfil y contraseña de la Coach. */
export function SettingsPage() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['risk-settings'], queryFn: statsApi.getRisk });
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1>Configuración</h1>
      <AppCard title="Alertas de riesgo">
        <p className="mb-4 text-sm text-neo-muted">
          Define cuándo una usuaria aparece como “necesita atención” en tu dashboard. Son indicadores de actividad, no un diagnóstico.
        </p>
        {isPending ? <SkeletonLoader lines={4} /> : error ? <ErrorState message="No pudimos cargar los umbrales." onRetry={() => void refetch()} /> : <RiskForm settings={data} />}
      </AppCard>
      <ProfileCard />
      <PasswordCard />
    </div>
  );
}
