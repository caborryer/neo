import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mail } from 'lucide-react';
import { UserStatus } from '@neo/shared-types';
import { updateUserSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ApiError } from '@/services/apiClient';
import { coachRoutes } from '@/app/routes';
import { formatDate } from '@/utils/format';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { ACCESS_ACTIONS } from '@/features/access-management/transitions';
import { ChangeAccessModal, type ChangeAccessTarget } from '@/features/access-management/ChangeAccessModal';
import { UserOverview } from '@/features/statistics/UserOverview';
import { AccessHistory } from '@/features/access-management/AccessHistory';
import { TIMEZONES } from './timezones';
import { isExpired, StatusBadge } from './userStatus';
import { usersApi, type UserSummary } from './usersApi';

interface ProfileForm {
  firstName: string;
  lastName: string;
  timezone: string;
  weeklyGoal: string;
}

const toSchemaInput = (v: ProfileForm) => ({ ...v, weeklyGoal: v.weeklyGoal === '' ? NaN : Number(v.weeklyGoal) });

function ProfileCard({ user }: { user: UserSummary }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileForm>({
    defaultValues: { firstName: user.firstName, lastName: user.lastName, timezone: user.timezone, weeklyGoal: String(user.weeklyGoal) },
    resolver: zodFormResolver<ProfileForm>(updateUserSchema, toSchemaInput),
  });

  const save = useMutation({
    mutationFn: (v: ProfileForm) =>
      usersApi.update(user.id, { firstName: v.firstName.trim(), lastName: v.lastName.trim(), timezone: v.timezone, weeklyGoal: Number(v.weeklyGoal) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['user', user.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      reset({ firstName: updated.firstName, lastName: updated.lastName, timezone: updated.timezone, weeklyGoal: String(updated.weeklyGoal) });
      setMessage({ ok: true, text: 'Datos guardados.' });
    },
    onError: (err) => setMessage({ ok: false, text: err instanceof ApiError && err.statusCode < 500 ? err.message : 'No pudimos guardar los datos.' }),
  });

  return (
    <AppCard title="Datos">
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((v) => {
          setMessage(null);
          save.mutate(v);
        })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <AppInput label="Nombre" error={errors.firstName?.message} {...register('firstName')} />
          <AppInput label="Apellido" error={errors.lastName?.message} {...register('lastName')} />
          <AppInput label="Correo" value={user.email} readOnly disabled hint="El correo no se puede cambiar." />
          <AppSelect label="Zona horaria" options={TIMEZONES} error={errors.timezone?.message} {...register('timezone')} />
          <AppInput label="Meta semanal de entrenamientos" type="number" min={1} max={14} error={errors.weeklyGoal?.message} {...register('weeklyGoal')} />
        </div>
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-sm text-neo-green' : 'text-sm text-red-700'}>
            {message.text}
          </p>
        )}
        <div className="flex justify-end">
          <AppButton type="submit" disabled={!isDirty} loading={save.isPending}>
            Guardar cambios
          </AppButton>
        </div>
      </form>
    </AppCard>
  );
}

function AccessCard({ user }: { user: UserSummary }) {
  const [target, setTarget] = useState<ChangeAccessTarget | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const resend = useMutation({
    mutationFn: () => usersApi.resendInvitation(user.id),
    onSuccess: (r) => setInviteMsg(r.invitationSent ? 'Invitación reenviada.' : 'No se pudo enviar el correo. Intenta de nuevo en unos minutos.'),
    onError: () => setInviteMsg('No pudimos reenviar la invitación.'),
  });

  const expired = isExpired(user.accessExpiresAt);
  const actions = ACCESS_ACTIONS[user.status];

  return (
    <AppCard title="Acceso">
      <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-neo-muted">Estado</dt>
          <dd className="mt-1"><StatusBadge status={user.status} /></dd>
        </div>
        <div>
          <dt className="text-xs text-neo-muted">Acceso hasta</dt>
          <dd className="mt-1 font-medium">
            {user.accessExpiresAt ? formatDate(user.accessExpiresAt) : 'Sin vencimiento'}
            {expired && <span className="ml-2 text-xs font-semibold text-red-700">Vencido</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neo-muted">Activada el</dt>
          <dd className="mt-1 font-medium">{formatDate(user.activatedAt)}</dd>
        </div>
      </dl>

      {expired && user.status === UserStatus.ACTIVE && (
        <p role="status" className="mb-4 rounded-neo-input bg-amber-50 px-3 py-2 text-sm text-amber-900">
          El acceso venció: la usuaria no puede ingresar. Extiende la vigencia para devolvérselo.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <AppButton
            key={a.target}
            variant={a.variant}
            onClick={() =>
              setTarget({
                status: a.target,
                title: `${a.label} a ${user.firstName}`,
                description: a.description,
                confirmLabel: a.label,
                danger: a.variant === 'danger',
              })
            }
          >
            {a.label}
          </AppButton>
        ))}
        {user.status === UserStatus.ACTIVE && (
          <AppButton
            variant="secondary"
            onClick={() =>
              setTarget({
                status: UserStatus.ACTIVE,
                title: 'Cambiar vigencia del acceso',
                description: 'Define hasta cuándo puede ingresar la usuaria o quita el vencimiento.',
                confirmLabel: 'Guardar vigencia',
              })
            }
          >
            Cambiar vigencia
          </AppButton>
        )}
        {user.status === UserStatus.PENDING && (
          <AppButton variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>
            <Mail className="size-4" aria-hidden="true" /> Reenviar invitación
          </AppButton>
        )}
      </div>
      {inviteMsg && (
        <p role="status" className="mt-3 text-sm text-neo-muted">
          {inviteMsg}
        </p>
      )}

      {/* key: el formulario del modal toma sus valores iniciales de la usuaria actual y del destino elegido. */}
      <ChangeAccessModal key={`${user.id}-${target?.status ?? 'none'}-${target?.title ?? ''}-${user.accessExpiresAt ?? ''}`} user={user} target={target} onClose={() => setTarget(null)} />
    </AppCard>
  );
}

export function UserDetailPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const created = (location.state as { created?: boolean; invitationSent?: boolean } | null) ?? null;
  const { data: user, isPending, error, refetch } = useQuery({ queryKey: ['user', id], queryFn: () => usersApi.get(id) });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link to={coachRoutes.users} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Usuarias
      </Link>

      {isPending ? (
        <AppCard>
          <SkeletonLoader lines={5} />
        </AppCard>
      ) : error ? (
        error instanceof ApiError && error.statusCode === 404 ? (
          <ErrorState message="No encontramos a esa usuaria." />
        ) : (
          <ErrorState message="No pudimos cargar la usuaria." onRetry={() => void refetch()} />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <h1>{user.firstName} {user.lastName}</h1>
            <StatusBadge status={user.status} />
          </div>
          {created?.created && (
            <p role="status" className="rounded-neo-input bg-neo-green-light px-3 py-2 text-sm text-neo-green">
              {created.invitationSent
                ? `Usuaria creada. Enviamos la invitación a ${user.email}.`
                : 'Usuaria creada, pero no pudimos enviar el correo. Usa “Reenviar invitación”.'}
            </p>
          )}
          <UserOverview key={`overview-${user.id}`} userId={user.id} userName={`${user.firstName} ${user.lastName}`} timezone={user.timezone} />
          <ProfileCard key={user.id} user={user} />
          <AccessCard user={user} />
          <AccessHistory userId={user.id} />
        </>
      )}
    </div>
  );
}
