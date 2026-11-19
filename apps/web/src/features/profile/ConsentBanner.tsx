import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AppButton } from '@/components/ui/AppButton';
import { userRoutes } from '@/app/routes';
import { useSession } from '@/features/auth/SessionProvider';
import { profileApi } from './profileApi';
import { PRIVACY_SUMMARY } from './ProfileSections';

/** HU-28: aviso visible mientras la usuaria no haya aceptado la política; permite aceptar sin salir de la pantalla. */
export function ConsentBanner() {
  const { user, setUser } = useSession();
  const [failed, setFailed] = useState(false);
  const accept = useMutation({ mutationFn: profileApi.acceptPrivacy, onSuccess: setUser, onError: () => setFailed(true) });

  if (!user || user.privacyConsentAt) return null;
  return (
    <div role="region" aria-label="Política de privacidad" className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 text-sm text-amber-950 md:flex-row md:items-center md:justify-between md:px-8">
        <p>
          {PRIVACY_SUMMARY} <Link to={userRoutes.profile} className="font-medium underline">Ver en mi perfil</Link>
        </p>
        <div className="flex flex-col items-start gap-1">
          <AppButton loading={accept.isPending} onClick={() => { setFailed(false); accept.mutate(); }}>Acepto</AppButton>
          {failed && <p role="alert" className="text-xs text-red-700">No pudimos registrar tu aceptación. Intenta de nuevo.</p>}
        </div>
      </div>
    </div>
  );
}
