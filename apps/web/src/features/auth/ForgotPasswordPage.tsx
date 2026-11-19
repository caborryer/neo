import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { ApiError } from '@/services/apiClient';
import { userRoutes } from '@/app/routes';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { AuthLayout } from './AuthLayout';
import { authApi } from './authApi';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodFormResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await authApi.forgotPassword(values);
      setSent(true);
    } catch (err) {
      setFormError(
        err instanceof ApiError && err.statusCode === 429
          ? 'Demasiados intentos. Espera un minuto e intenta de nuevo.'
          : 'No pudimos procesar la solicitud. Intenta de nuevo.',
      );
    }
  });

  return (
    <AuthLayout title="Recuperar contraseña" subtitle="Te enviaremos un enlace para crear una nueva.">
      {sent ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="rounded-neo-input bg-neo-green-light px-3 py-2 text-sm text-neo-green">
            Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también tu carpeta de spam.
          </p>
          <Link to={userRoutes.login} className="text-center text-sm font-medium text-neo-primary-dark hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {formError && (
            <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">
              {formError}
            </p>
          )}
          <AppInput label="Correo" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />
          <AppButton type="submit" fullWidth loading={isSubmitting}>
            Enviar enlace
          </AppButton>
          <Link to={userRoutes.login} className="text-center text-sm font-medium text-neo-primary-dark hover:underline">
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
