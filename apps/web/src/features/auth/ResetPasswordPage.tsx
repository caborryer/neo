import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { resetPasswordSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ApiError } from '@/services/apiClient';
import { userRoutes } from '@/app/routes';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { AuthLayout } from './AuthLayout';
import { authApi } from './authApi';

interface FormValues {
  password: string;
  confirmPassword: string;
}

/** Sirve para crear la contraseña (enlace de invitación, HU-02) y para restablecerla (HU-02). */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const isInvitation = params.get('invitation') === '1';
  const [done, setDone] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodFormResolver<FormValues>(resetPasswordSchema, (v) => ({ token: token || 'x', ...v })),
  });

  const title = isInvitation ? 'Crea tu contraseña' : 'Restablecer contraseña';

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authApi.resetPassword({ token, ...values });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 400 && !err.details.length) setLinkInvalid(true);
      else setFormError('No pudimos guardar la contraseña. Intenta de nuevo.');
    }
  });

  if (!token || linkInvalid) {
    return (
      <AuthLayout title="Enlace no válido">
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-sm text-neo-dark">
            El enlace es inválido o ya expiró. Solicita uno nuevo
            {isInvitation ? ' a tu Coach.' : '.'}
          </p>
          {!isInvitation && (
            <Link to={userRoutes.forgotPassword} className="text-sm font-medium text-neo-primary-dark hover:underline">
              Solicitar un nuevo enlace
            </Link>
          )}
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="¡Listo!">
        <div className="flex flex-col gap-4">
          <p role="status" className="rounded-neo-input bg-neo-green-light px-3 py-2 text-sm text-neo-green">
            {isInvitation ? 'Tu contraseña quedó creada y tu cuenta está activa.' : 'Tu contraseña fue actualizada.'} Ya puedes iniciar sesión.
          </p>
          <Link to={userRoutes.login} className="text-center text-sm font-semibold text-neo-primary-dark hover:underline">
            Ir a iniciar sesión
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={title} subtitle="Elige una contraseña de al menos 8 caracteres.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">
            {formError}
          </p>
        )}
        <PasswordInput label="Nueva contraseña" autoComplete="new-password" error={errors.password?.message} {...register('password')} />
        <PasswordInput
          label="Confirmar contraseña"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <AppButton type="submit" fullWidth loading={isSubmitting}>
          Guardar contraseña
        </AppButton>
      </form>
    </AuthLayout>
  );
}
