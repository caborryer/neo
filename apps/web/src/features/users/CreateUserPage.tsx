import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { createUserSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { ApiError } from '@/services/apiClient';
import { coachRoutes } from '@/app/routes';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { endOfDateInput } from '@/utils/format';
import { TIMEZONES } from './timezones';
import { usersApi } from './usersApi';

interface FormValues {
  firstName: string;
  lastName: string;
  email: string;
  timezone: string;
  accessExpiresAt: string;
}

const toSchemaInput = (v: FormValues) => ({
  ...v,
  accessExpiresAt: v.accessExpiresAt ? endOfDateInput(v.accessExpiresAt) : undefined,
});

export function CreateUserPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { firstName: '', lastName: '', email: '', timezone: 'America/Bogota', accessExpiresAt: '' },
    resolver: zodFormResolver<FormValues>(createUserSchema, toSchemaInput),
  });

  const create = useMutation({
    mutationFn: (v: FormValues) =>
      usersApi.create({
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
        email: v.email.trim().toLowerCase(),
        timezone: v.timezone,
        accessExpiresAt: v.accessExpiresAt ? endOfDateInput(v.accessExpiresAt).toISOString() : undefined,
      }),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      navigate(coachRoutes.user(user.id), { replace: true, state: { created: true, invitationSent: user.invitationSent } });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.statusCode === 409) setError('email', { message: 'Ya existe una usuaria con ese correo' });
      else if (err instanceof ApiError && err.details.length) {
        for (const d of err.details) setError(d.field as keyof FormValues, { message: d.message });
      } else setFormError('No pudimos crear la usuaria. Intenta de nuevo.');
    },
  });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <Link to={coachRoutes.users} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Usuarias
      </Link>
      <h1>Crear usuaria</h1>
      <AppCard>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((v) => {
            setFormError(null);
            create.mutate(v);
          })}
        >
          {formError && (
            <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">
              {formError}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <AppInput label="Nombre" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
            <AppInput label="Apellido" autoComplete="off" error={errors.lastName?.message} {...register('lastName')} />
          </div>
          <AppInput label="Correo" type="email" inputMode="email" autoComplete="off" error={errors.email?.message} {...register('email')} />
          <AppSelect label="Zona horaria" options={TIMEZONES} error={errors.timezone?.message} {...register('timezone')} />
          <AppInput
            label="Acceso hasta (opcional)"
            type="date"
            hint="Si lo dejas vacío, el acceso no vence."
            error={errors.accessExpiresAt?.message}
            {...register('accessExpiresAt')}
          />
          <p className="text-sm text-neo-muted">
            La usuaria quedará <strong>Pendiente</strong> y recibirá por correo un enlace (válido 24 horas) para crear su contraseña.
          </p>
          <div className="flex justify-end gap-2">
            <Link to={coachRoutes.users}>
              <AppButton variant="secondary">Cancelar</AppButton>
            </Link>
            <AppButton type="submit" loading={create.isPending}>
              Crear y enviar invitación
            </AppButton>
          </div>
        </form>
      </AppCard>
    </div>
  );
}
