import { LogoutButton } from '@/features/auth/LogoutButton';
import { PasswordCard, PrivacyCard, ProfileCard } from './ProfileSections';

/** HU-24 · U08: perfil de la usuaria. */
export function ProfilePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1>Perfil</h1>
      <ProfileCard />
      <PrivacyCard />
      <PasswordCard />
      <LogoutButton className="self-start border border-neo-border" />
    </div>
  );
}
