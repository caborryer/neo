import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { UserRole } from '@neo/shared-types';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { userRoutes } from '@/app/routes';
import { homeFor, useSession } from './SessionProvider';

function FullPageLoader() {
  return (
    <div className="mx-auto max-w-md p-8">
      <SkeletonLoader lines={4} />
    </div>
  );
}

/** Exige sesión y el rol indicado; si no, redirige. (La autorización real la hace el backend.) */
export function RequireRole({ role }: { role: UserRole }) {
  const { user, loading } = useSession();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to={userRoutes.login} replace state={{ from: location.pathname + location.search }} />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

/** Login y recuperación: si ya hay sesión se manda a la usuaria a su inicio. */
export function PublicOnly() {
  const { user, loading } = useSession();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}
