import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { ImagePlus, ShieldCheck } from 'lucide-react';
import type { AuthUser } from '@neo/shared-types';
import { changePasswordSchema, updateProfileSchema } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useSession } from '@/features/auth/SessionProvider';
import { IMAGE_TYPES, MAX_IMAGE_MB, mediaApi } from '@/features/nutrition/nutritionApi';
import { TIMEZONES } from '@/features/users/timezones';
import { ApiError } from '@/services/apiClient';
import { formatDate } from '@/utils/format';
import { zodFormResolver } from '@/utils/zodFormResolver';
import { profileApi } from './profileApi';

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.statusCode < 500 ? e.message : fallback);

function Message({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-neo-green' : 'text-sm text-red-700'}>
      {msg.text}
    </p>
  );
}

/** Texto corto de la política (HU-28). La versión completa la define el negocio. */
export const PRIVACY_SUMMARY =
  'Usaremos tus datos y las fotos de tus comidas solo para tu acompañamiento con tu Coach. Las fotos son privadas: solo las ves tú y tu Coach, y no se comparten con otras usuarias.';

/** HU-24: foto, nombre, apellido y zona horaria. Disponible para usuaria y Coach. */
export function ProfileCard() {
  const { user } = useSession();
  // El formulario toma sus valores iniciales de la usuaria: solo se monta cuando ya está cargada.
  return user ? <ProfileCardInner key={user.id} user={user} /> : null;
}

function ProfileCardInner({ user }: { user: AuthUser }) {
  const { setUser } = useSession();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<{ firstName: string; lastName: string; timezone: string }>({
    defaultValues: { firstName: user.firstName, lastName: user.lastName, timezone: user.timezone },
    resolver: zodFormResolver(updateProfileSchema),
  });

  const save = useMutation({
    mutationFn: (v: { firstName: string; lastName: string; timezone: string }) =>
      profileApi.update({ firstName: v.firstName.trim(), lastName: v.lastName.trim(), timezone: v.timezone }),
    onSuccess: (u) => {
      setUser(u);
      reset({ firstName: u.firstName, lastName: u.lastName, timezone: u.timezone });
      setMsg({ ok: true, text: 'Perfil actualizado.' });
    },
    onError: (e) => setMsg({ ok: false, text: errText(e, 'No pudimos guardar tu perfil.') }),
  });

  const avatar = useMutation({
    mutationFn: async (file: File) => profileApi.update({ avatarAssetId: (await mediaApi.uploadImage(file)).id }),
    onSuccess: (u) => {
      setUser(u);
      setPhotoMsg({ ok: true, text: 'Foto actualizada.' });
    },
    onError: (e) => setPhotoMsg({ ok: false, text: errText(e, 'No pudimos subir la foto.') }),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return setPhotoMsg({ ok: false, text: 'Usa una imagen JPG, PNG o WebP.' });
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setPhotoMsg({ ok: false, text: `La imagen supera ${MAX_IMAGE_MB} MB.` });
    setPhotoMsg(null);
    avatar.mutate(file);
  };

  return (
    <AppCard title="Mi perfil">
      <div className="mb-4 flex items-center gap-4">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="Tu foto de perfil" className="size-16 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-full bg-neo-pink-light text-xl font-bold text-neo-primary-dark">
            {user.firstName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="flex flex-col gap-1">
          <input ref={fileRef} type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" aria-label="Elegir foto de perfil" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
          <AppButton variant="secondary" loading={avatar.isPending} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" aria-hidden="true" /> {user.avatarUrl ? 'Cambiar foto' : 'Subir foto'}
          </AppButton>
          <Message msg={photoMsg} />
        </div>
      </div>

      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => { setMsg(null); save.mutate(v); })}>
        <div className="grid gap-4 sm:grid-cols-2">
          <AppInput label="Nombre" error={errors.firstName?.message} {...register('firstName')} />
          <AppInput label="Apellido" error={errors.lastName?.message} {...register('lastName')} />
          <AppInput label="Correo" value={user.email} readOnly disabled hint="El correo no se puede cambiar." />
          <AppSelect label="Zona horaria" options={TIMEZONES} error={errors.timezone?.message} {...register('timezone')} />
        </div>
        <Message msg={msg} />
        <div className="flex justify-end">
          <AppButton type="submit" disabled={!isDirty} loading={save.isPending}>Guardar cambios</AppButton>
        </div>
      </form>
    </AppCard>
  );
}

/** HU-24: cambio de contraseña con la actual. Cierra las demás sesiones abiertas. */
export function PasswordCard() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ currentPassword: string; newPassword: string; confirmPassword: string }>({
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    resolver: zodFormResolver(changePasswordSchema),
  });

  const change = useMutation({
    mutationFn: profileApi.changePassword,
    onSuccess: () => {
      reset();
      setMsg({ ok: true, text: 'Contraseña actualizada. Cerramos tus otras sesiones abiertas.' });
    },
    onError: (e) => setMsg({ ok: false, text: errText(e, 'No pudimos cambiar tu contraseña.') }),
  });

  return (
    <AppCard title="Contraseña">
      <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit((v) => { setMsg(null); change.mutate(v); })}>
        <PasswordInput label="Contraseña actual" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <PasswordInput label="Nueva contraseña" autoComplete="new-password" error={errors.newPassword?.message} {...register('newPassword')} />
          <PasswordInput label="Confirmar nueva contraseña" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        </div>
        <Message msg={msg} />
        <div className="flex justify-end">
          <AppButton type="submit" loading={change.isPending}>Cambiar contraseña</AppButton>
        </div>
      </form>
    </AppCard>
  );
}

/** HU-28: aceptación de la política de privacidad y del uso de fotos. Sin ella no se pueden subir imágenes. */
export function PrivacyCard() {
  const { user, setUser } = useSession();
  const [error, setError] = useState<string | null>(null);
  const accept = useMutation({
    mutationFn: profileApi.acceptPrivacy,
    onSuccess: setUser,
    onError: (e) => setError(errText(e, 'No pudimos registrar tu aceptación.')),
  });

  return (
    <AppCard title="Privacidad y fotos">
      <p className="mb-3 flex items-start gap-2 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-neo-muted" aria-hidden="true" />
        {PRIVACY_SUMMARY}
      </p>
      {user?.privacyConsentAt ? (
        <p role="status" className="text-sm text-neo-green">Aceptaste la política el {formatDate(user.privacyConsentAt)}.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-amber-900">Para subir fotos de tus comidas necesitas aceptar esta política.</p>
          {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
          <AppButton loading={accept.isPending} onClick={() => { setError(null); accept.mutate(); }}>Acepto la política de privacidad</AppButton>
        </>
      )}
    </AppCard>
  );
}
