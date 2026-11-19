import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { loginSchema, type LoginInput } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppInput } from '@/components/ui/AppInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { ApiError } from '@/services/apiClient';
import { userRoutes } from '@/app/routes';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { AuthLayout } from './AuthLayout';
import { authApi } from './authApi';
import { homeFor, useSession } from './SessionProvider';

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.statusCode === 401) return 'Correo o contraseña incorrectos.';
    if (err.statusCode === 403) return err.message; // "Tu acceso no está disponible…"
    if (err.statusCode === 429) return 'Demasiados intentos. Espera un minuto e intenta de nuevo.';
  }
  return 'No pudimos iniciar sesión. Revisa tu conexión e intenta de nuevo.';
}

export function LoginPage() {
  const { setUser } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodFormResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await authApi.login(values);
      setUser(user);
      const from = (location.state as { from?: string } | null)?.from;
      // Solo se vuelve a rutas internas de la propia app.
      navigate(from && from.startsWith('/') && !from.startsWith('//') ? from : homeFor(user), { replace: true });
    } catch (err) {
      setFormError(loginErrorMessage(err));
    }
  });

  return (
    <AuthLayout title="Iniciar sesión" subtitle="Bienvenida de vuelta a Neo.">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {formError && (
          <p role="alert" className="rounded-neo-input bg-red-50 px-3 py-2 text-sm text-red-900">
            {formError}
          </p>
        )}
        <AppInput label="Correo" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Contraseña" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <AppButton type="submit" fullWidth loading={isSubmitting}>
          Iniciar sesión
        </AppButton>
        <Link to={userRoutes.forgotPassword} className="text-center text-sm font-medium text-neo-primary-dark hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </AuthLayout>
  );
}
