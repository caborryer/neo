import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { UsersListPage } from './UsersListPage';
import { CreateUserPage } from './CreateUserPage';
import { UserDetailPage } from './UserDetailPage';
import { coach, json, renderWithProviders } from '@/test/utils';
import type { UserSummary } from './usersApi';

const mk = (over: Partial<UserSummary> = {}): UserSummary => ({
  id: '11111111-1111-4111-8111-111111111111', firstName: 'Ana', lastName: 'Ruiz', email: 'ana@neo.co', status: 'ACTIVE' as UserSummary['status'],
  timezone: 'America/Bogota', weeklyGoal: 3, accessExpiresAt: null, activatedAt: '2026-11-01T10:00:00.000Z', createdAt: '2026-10-30T10:00:00.000Z', ...over,
});
const list = (data: UserSummary[], total = data.length) => json({ data, meta: { page: 1, limit: 10, total, totalPages: Math.max(1, Math.ceil(total / 10)) } });

interface Call { method: string; path: string; query: URLSearchParams; body: any }
function mockApi(handler: (c: Call) => Response | undefined) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const c: Call = { method: (init as RequestInit | undefined)?.method ?? 'GET', path: url.pathname.replace('/api/v1', ''), query: url.searchParams, body: init?.body ? JSON.parse(init.body as string) : undefined };
    calls.push(c);
    if (c.path === '/users/me') return json({ data: coach });
    const r = handler(c);
    if (!r) throw new Error(`Sin mock para ${c.method} ${c.path}`);
    return r;
  });
  return calls;
}
afterEach(() => vi.restoreAllMocks());

describe('UsersListPage (HU-05/06)', () => {
  it('lista usuarias con estado (texto) y meta semanal', async () => {
    mockApi((c) => (c.path === '/coach/users' ? list([mk(), mk({ id: '2', firstName: 'Bea', status: 'SUSPENDED' as UserSummary['status'] })]) : undefined));
    renderWithProviders(<UsersListPage />);
    expect((await screen.findAllByText('Ana Ruiz')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Suspendida').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Activa').length).toBeGreaterThan(0);
  });

  it('sin usuarias muestra el estado vacío con acción para crear', async () => {
    mockApi((c) => (c.path === '/coach/users' ? list([]) : undefined));
    renderWithProviders(<UsersListPage />);
    expect(await screen.findByText('Aún no tienes usuarias')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Crear usuaria/ }).length).toBeGreaterThan(0);
  });

  it('la búsqueda y el filtro de estado se envían al backend y vuelven a la página 1', async () => {
    const calls = mockApi((c) => (c.path === '/coach/users' ? list([mk()]) : undefined));
    renderWithProviders(<UsersListPage />);
    await screen.findAllByText('Ana Ruiz');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por estado'), 'SUSPENDED');
    await userEvent.type(screen.getByLabelText('Buscar por nombre o correo'), 'ana');
    await vi.waitFor(() => {
      const last = calls.filter((c) => c.path === '/coach/users').at(-1)!;
      expect(last.query.get('status')).toBe('SUSPENDED');
      expect(last.query.get('search')).toBe('ana');
      expect(last.query.get('page')).toBe('1');
    });
  });

  it('con filtros sin coincidencias muestra "Sin resultados"', async () => {
    mockApi((c) => (c.path === '/coach/users' ? list([]) : undefined));
    renderWithProviders(<UsersListPage />);
    await screen.findByText('Aún no tienes usuarias');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por estado'), 'INACTIVE');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('un error del servidor ofrece reintentar', async () => {
    mockApi((c) => (c.path === '/coach/users' ? json({ statusCode: 500, message: 'x', error: 'x' }, 500) : undefined));
    renderWithProviders(<UsersListPage />);
    expect(await screen.findByRole('button', { name: 'Reintentar' }, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe('CreateUserPage (HU-05)', () => {
  const fill = async (email = 'nueva@neo.co') => {
    await userEvent.type(await screen.findByLabelText('Nombre'), 'Nora');
    await userEvent.type(screen.getByLabelText('Apellido'), 'Pérez');
    await userEvent.type(screen.getByLabelText('Correo'), email);
  };

  it('valida campos obligatorios', async () => {
    mockApi(() => undefined);
    renderWithProviders(<CreateUserPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Crear y enviar invitación/ }));
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El apellido es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('Correo inválido')).toBeInTheDocument();
  });

  it('rechaza una fecha de acceso pasada', async () => {
    mockApi(() => undefined);
    renderWithProviders(<CreateUserPage />);
    await fill();
    await userEvent.type(screen.getByLabelText(/Acceso hasta/), '2020-01-01');
    await userEvent.click(screen.getByRole('button', { name: /Crear y enviar invitación/ }));
    expect(await screen.findByText('La fecha de expiración debe ser futura')).toBeInTheDocument();
  });

  it('crea la usuaria con correo normalizado y navega a su ficha', async () => {
    const calls = mockApi((c) => {
      if (c.method === 'POST' && c.path === '/coach/users') return json({ data: { ...mk({ id: 'abc', status: 'PENDING' as UserSummary['status'] }), invitationSent: true } }, 201);
      return undefined;
    });
    renderWithProviders(<CreateUserPage />);
    await fill(' NUEVA@Neo.co ');
    await userEvent.click(screen.getByRole('button', { name: /Crear y enviar invitación/ }));
    await vi.waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/coach/users/abc'));
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ firstName: 'Nora', lastName: 'Pérez', email: 'nueva@neo.co', timezone: 'America/Bogota' });
  });

  it('correo duplicado (409) se muestra en el campo', async () => {
    mockApi((c) => (c.method === 'POST' ? json({ statusCode: 409, message: 'Ya existe una usuaria con ese correo', error: 'Conflict' }, 409) : undefined));
    renderWithProviders(<CreateUserPage />);
    await fill('repetida@neo.co');
    await userEvent.click(screen.getByRole('button', { name: /Crear y enviar invitación/ }));
    expect(await screen.findByText('Ya existe una usuaria con ese correo')).toBeInTheDocument();
  });
});

describe('UserDetailPage: acceso (HU-06/07/28)', () => {
  const ID = '11111111-1111-4111-8111-111111111111';
  const history = json({ data: [{ id: 'e1', previousStatus: null, newStatus: 'PENDING', reason: 'Alta de usuaria', changedBy: 'Cata Coach', createdAt: '2026-10-30T10:00:00.000Z' }], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } });
  const routes = <Route path="/coach/users/:id" element={<UserDetailPage />} />;

  const setup = (user: UserSummary, onAccess?: (c: Call) => Response) =>
    mockApi((c) => {
      if (c.method === 'GET' && c.path === `/coach/users/${ID}`) return json({ data: user });
      if (c.path.endsWith('/access-history')) return history.clone();
      if (c.method === 'PATCH' && c.path.endsWith('/access')) return onAccess?.(c) ?? json({ data: { id: ID } });
      return undefined;
    });

  it('muestra el historial con quién y por qué', async () => {
    setup(mk());
    renderWithProviders(<p />, { route: `/coach/users/${ID}`, routes });
    expect(await screen.findByText('Creada como Pendiente')).toBeInTheDocument();
    expect(screen.getByText(/Cata Coach/)).toBeInTheDocument();
    expect(screen.getByText('“Alta de usuaria”')).toBeInTheDocument();
  });

  it('suspender pide confirmación y envía estado + motivo', async () => {
    const calls = setup(mk());
    renderWithProviders(<p />, { route: `/coach/users/${ID}`, routes });
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Motivo/), 'Pago pendiente');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));
    await vi.waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && c.path.endsWith('/access'))).toBe(true));
    expect(calls.find((c) => c.path.endsWith('/access'))!.body).toEqual({ status: 'SUSPENDED', reason: 'Pago pendiente' });
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Escape cierra el diálogo sin enviar nada', async () => {
    const calls = setup(mk());
    renderWithProviders(<p />, { route: `/coach/users/${ID}`, routes });
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('reactivar envía accessExpiresAt explícito (null si queda vacío) para no heredar un vencimiento pasado', async () => {
    const calls = setup(mk({ status: 'SUSPENDED' as UserSummary['status'], accessExpiresAt: '2020-01-01T00:00:00.000Z' }));
    renderWithProviders(<p />, { route: `/coach/users/${ID}`, routes });
    await userEvent.click(await screen.findByRole('button', { name: 'Reactivar' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Acceso hasta/)).toHaveValue('');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reactivar' }));
    await vi.waitFor(() => expect(calls.some((c) => c.path.endsWith('/access'))).toBe(true));
    expect(calls.find((c) => c.path.endsWith('/access'))!.body).toEqual({ status: 'ACTIVE', accessExpiresAt: null });
  });

  it('un error del backend se muestra dentro del diálogo y no lo cierra', async () => {
    setup(mk(), () => json({ statusCode: 400, message: 'No se puede pasar de ACTIVE a SUSPENDED', error: 'Bad Request' }, 400));
    renderWithProviders(<p />, { route: `/coach/users/${ID}`, routes });
    await userEvent.click(await screen.findByRole('button', { name: 'Suspender' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('No se puede pasar');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('acceso vencido: avisa y ofrece cambiar la vigencia', async () => {
    setup(mk({ accessExpiresAt: '2020-01-01T00:00:00.000Z' }));
    renderWithProviders(<p />, { route: `/coach/users/${ID}`, routes });
    expect(await screen.findByText(/El acceso venció/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar vigencia' })).toBeInTheDocument();
  });

  it('pendiente: permite reenviar la invitación', async () => {
    const calls = mockApi((c) => {
      if (c.path === `/coach/users/${ID}` && c.method === 'GET') return json({ data: mk({ status: 'PENDING' as UserSummary['status'] }) });
      if (c.path.endsWith('/access-history')) return history.clone();
      if (c.path.endsWith('/resend-invitation')) return json({ data: { invitationSent: true } });
      return undefined;
    });
    renderWithProviders(<p />, { route: `/coach/users/${ID}`, routes });
    await userEvent.click(await screen.findByRole('button', { name: /Reenviar invitación/ }));
    expect(await screen.findByText('Invitación reenviada.')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/resend-invitation'))).toBe(true);
  });

  it('usuaria inexistente (404) muestra mensaje', async () => {
    mockApi((c) => (c.path === `/coach/users/${ID}` ? json({ statusCode: 404, message: 'Usuaria no encontrada', error: 'Not Found' }, 404) : undefined));
    renderWithProviders(<p />, { route: `/coach/users/${ID}`, routes });
    expect(await screen.findByText('No encontramos a esa usuaria.')).toBeInTheDocument();
  });
});
