import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRole, type AuthUser } from '@neo/shared-types';
import { ApiError, setSessionLostHandler } from '@/services/apiClient';
import { coachRoutes, userRoutes } from '@/app/routes';
import { authApi } from './authApi';

const SESSION_KEY = ['session'] as const;

interface SessionValue {
  user: AuthUser | null;
  loading: boolean;
  /** Guarda la usuaria devuelta por el login sin una petición extra. */
  setUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Ruta de inicio según el rol. El backend sigue siendo la autoridad de permisos; esto es solo navegación. */
export const homeFor = (user: Pick<AuthUser, 'role'>): string =>
  user.role === UserRole.COACH ? coachRoutes.dashboard : userRoutes.dashboard;

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const query = useQuery<AuthUser | null>({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (err) {
        // 401 (sin sesión) y 403 (acceso no disponible): no hay sesión utilizable.
        if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) return null;
        throw err;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const clearSession = useCallback(() => {
    queryClient.setQueryData(SESSION_KEY, null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
  }, [queryClient]);

  // Si el cliente HTTP no logra renovar la sesión, se cierra en la UI y las rutas protegidas redirigen a /login.
  useEffect(() => {
    setSessionLostHandler(clearSession);
    return () => setSessionLostHandler(undefined);
  }, [clearSession]);

  const value = useMemo<SessionValue>(
    () => ({
      user: query.data ?? null,
      loading: query.isPending,
      setUser: (user) => queryClient.setQueryData(SESSION_KEY, user),
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          clearSession();
        }
      },
    }),
    [query.data, query.isPending, queryClient, clearSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}
