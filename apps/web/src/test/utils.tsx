import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { AuthUser } from '@neo/shared-types';
import { SessionProvider } from '@/features/auth/SessionProvider';

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export const coach: AuthUser = {
  id: 'c1', firstName: 'Cata', lastName: 'Coach', email: 'coach@neo.co', role: 'COACH' as AuthUser['role'],
  status: 'ACTIVE' as AuthUser['status'], timezone: 'America/Bogota', avatarUrl: null, accessExpiresAt: null, privacyConsentAt: '2026-01-01T00:00:00.000Z',
};
export const member: AuthUser = { ...coach, id: 'u1', role: 'USER' as AuthUser['role'], email: 'ana@neo.co' };

export function LocationProbe() {
  const l = useLocation();
  return <div data-testid="location">{l.pathname}</div>;
}

/** Renderiza con QueryClient, sesión real (fetch mockeado) y router en memoria. */
export function renderWithProviders(ui: ReactElement, { route = '/', routes }: { route?: string; routes?: ReactElement } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            {routes ?? <Route path="*" element={ui} />}
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );
}
