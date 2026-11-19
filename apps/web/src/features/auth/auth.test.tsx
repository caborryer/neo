import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { LoginPage } from './LoginPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { PublicOnly, RequireRole } from './RouteGuards';
import { coach, json, member, renderWithProviders } from '@/test/utils';
import { UserRole } from '@neo/shared-types';

const err = (statusCode: number, message: string, details?: unknown) => json({ statusCode, message, error: 'x', details }, statusCode);

/** Enruta fetch por método+ruta; /users/me por defecto = sin sesión. */
function mockApi(handlers: Record<string, () => Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const key = `${(init as RequestInit | undefined)?.method ?? 'GET'} ${url.pathname.replace('/api/v1', '')}`;
    const h = handlers[key];
    if (h) return h();
    if (key === 'GET /users/me') return err(401, 'Sesión no iniciada');
    if (key === 'POST /auth/refresh') return err(401, 'Sesión inválida');
    throw new Error(`Sin mock para ${key}`);
  });
}

afterEach(() => vi.restoreAllMocks());

const loginRoutes = (
  <>
    <Route element={<PublicOnly />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>
    <Route element={<RequireRole role={UserRole.COACH} />}>
      <Route path="/coach/dashboard" element={<p>Panel Coach</p>} />
    </Route>
    <Route element={<RequireRole role={UserRole.USER} />}>
      <Route path="/app/dashboard" element={<p>Inicio usuaria</p>} />
    </Route>
  </>
);

describe('LoginPage (HU-01)', () => {
  it('valida campos vacíos sin llamar a la API', async () => {
    const f = mockApi({});
    renderWithProviders(<LoginPage />, { route: '/login', routes: loginRoutes });
    await userEvent.click(await screen.findByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Correo inválido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
    expect(f.mock.calls.some(([u]) => String(u).includes('/auth/login'))).toBe(false);
  });

  it('login de usuaria → redirige a /app/dashboard', async () => {
    mockApi({ 'POST /auth/login': () => json({ data: member }) });
    renderWithProviders(<LoginPage />, { route: '/login', routes: loginRoutes });
    await userEvent.type(await screen.findByLabelText('Correo'), 'ana@neo.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Inicio usuaria')).toBeInTheDocument();
  });

  it('login de la Coach → redirige a /coach/dashboard', async () => {
    mockApi({ 'POST /auth/login': () => json({ data: coach }) });
    renderWithProviders(<LoginPage />, { route: '/login', routes: loginRoutes });
    await userEvent.type(await screen.findByLabelText('Correo'), 'coach@neo.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'Secreta123');
    await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Panel Coach')).toBeInTheDocument();
  });

  it('401 muestra un mensaje genérico; 403 el motivo del acceso; 429 pide esperar', async () => {
    const responses = [err(401, 'Credenciales inválidas'), err(403, 'Tu acceso no está disponible. Comunícate con tu Coach.'), err(429, 'ThrottlerException')];
    mockApi({ 'POST /auth/login': () => responses.shift()! });
    renderWithProviders(<LoginPage />, { route: '/login', routes: loginRoutes });
    await userEvent.type(await screen.findByLabelText('Correo'), 'ana@neo.co');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'x');
    const submit = screen.getByRole('button', { name: 'Iniciar sesión' });
    await userEvent.click(submit);
    expect(await screen.findByText('Correo o contraseña incorrectos.')).toBeInTheDocument();
    await userEvent.click(submit);
    expect(await screen.findByText(/Tu acceso no está disponible/)).toBeInTheDocument();
    await userEvent.click(submit);
    expect(await screen.findByText(/Demasiados intentos/)).toBeInTheDocument();
  });

  it('el botón mostrar/ocultar cambia el tipo del campo', async () => {
    mockApi({});
    renderWithProviders(<LoginPage />, { route: '/login', routes: loginRoutes });
    const input = await screen.findByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('RouteGuards', () => {
  it('sin sesión, una ruta protegida redirige a /login', async () => {
    mockApi({});
    renderWithProviders(<p />, { route: '/coach/dashboard', routes: loginRoutes });
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/login'));
  });

  it('una usuaria que entra a rutas de la Coach vuelve a su inicio', async () => {
    mockApi({ 'GET /users/me': () => json({ data: member }) });
    renderWithProviders(<p />, { route: '/coach/dashboard', routes: loginRoutes });
    expect(await screen.findByText('Inicio usuaria')).toBeInTheDocument();
  });

  it('con sesión, /login redirige al inicio del rol', async () => {
    mockApi({ 'GET /users/me': () => json({ data: coach }) });
    renderWithProviders(<p />, { route: '/login', routes: loginRoutes });
    expect(await screen.findByText('Panel Coach')).toBeInTheDocument();
  });
});

describe('ForgotPasswordPage (HU-02)', () => {
  it('muestra siempre el mensaje genérico tras enviar', async () => {
    mockApi({ 'POST /auth/forgot-password': () => json({ data: { message: 'ok' } }) });
    renderWithProviders(<ForgotPasswordPage />);
    await userEvent.type(await screen.findByLabelText('Correo'), 'nadie@neo.co');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Si el correo está registrado');
  });

  it('rechaza un correo inválido', async () => {
    mockApi({});
    renderWithProviders(<ForgotPasswordPage />);
    await userEvent.type(await screen.findByLabelText('Correo'), 'mal');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByText('Correo inválido')).toBeInTheDocument();
  });
});

describe('ResetPasswordPage (HU-02)', () => {
  it('sin token muestra enlace no válido', async () => {
    mockApi({});
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password' });
    expect(await screen.findByText('Enlace no válido')).toBeInTheDocument();
  });

  it('valida longitud y coincidencia de contraseñas', async () => {
    mockApi({});
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc' });
    await userEvent.type(await screen.findByLabelText('Nueva contraseña'), 'corta');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'otra');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Mínimo 8 caracteres')).toBeInTheDocument();
  });

  it('invitación: guarda la contraseña y confirma que la cuenta quedó activa', async () => {
    const f = mockApi({ 'POST /auth/reset-password': () => json({ data: { message: 'ok' } }) });
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc&invitation=1' });
    expect(await screen.findByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave1');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'NuevaClave1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText(/cuenta está activa/)).toBeInTheDocument();
    const call = f.mock.calls.find(([u]) => String(u).includes('/auth/reset-password'))!;
    expect(JSON.parse((call[1] as RequestInit).body as string)).toMatchObject({ token: 'abc', password: 'NuevaClave1' });
  });

  it('token expirado (400) muestra enlace no válido', async () => {
    mockApi({ 'POST /auth/reset-password': () => err(400, 'El enlace es inválido o ya expiró') });
    renderWithProviders(<ResetPasswordPage />, { route: '/reset-password?token=abc' });
    await userEvent.type(await screen.findByLabelText('Nueva contraseña'), 'NuevaClave1');
    await userEvent.type(screen.getByLabelText('Confirmar contraseña'), 'NuevaClave1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Enlace no válido')).toBeInTheDocument();
  });
});
