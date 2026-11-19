import type { ReactElement } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { CoachDashboardPage } from './CoachDashboardPage';
import { UserDashboardPage } from './UserDashboardPage';
import { SettingsPage } from './SettingsPage';
import { UserOverview } from './UserOverview';
import { AdherenceChart } from './AdherenceChart';
import { NotificationsPage, targetOf } from '@/features/notifications/NotificationsPage';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { ConsentBanner } from '@/features/profile/ConsentBanner';
import { SchedulesPage } from '@/features/nutrition/SchedulesPage';
import { coach, json, member, renderWithProviders } from '@/test/utils';

const UID = '11111111-1111-4111-8111-111111111111';
const adherence = (over: object = {}) => ({ scheduled: 10, completed: 8, partial: 1, skipped: 1, missed: 0, upcoming: 2, adherence: 80, partialRate: 10, ...over });
const dashboard = (over: object = {}) => ({
  rangeDays: 30, activeUsers: 4, goalsMet: 2, workouts: adherence(), upcomingWeek: 6,
  chart: [{ label: '11-01', date: '2026-11-01', scheduled: 5, completed: 4, adherence: 80 }, { label: '11-08', date: '2026-11-08', scheduled: 5, completed: 4, adherence: 80 }],
  nutrition: { pendingReview: 3, submitted: 9, usersWithPlan: 3, usersWithoutPlan: 1 },
  atRisk: [{ userId: UID, userName: 'Ana Ruiz', reasons: [{ code: 'INACTIVITY', message: 'Lleva 9 días sin entrenar' }], lastFollowUpAt: null }],
  atRiskTotal: 1, ...over,
});
const stats = (over: object = {}) => ({
  rangeDays: 30, adherence: adherence(), weekly: { completed: 1, goal: 3 }, lastWorkoutDate: '2026-11-10',
  risk: [{ code: 'INACTIVITY', message: 'Lleva 9 días sin entrenar' }],
  followUps: [{ id: 'f1', note: 'Le escribí', reasons: ['INACTIVITY'], coachName: 'Cata Coach', createdAt: '2026-11-12T10:00:00Z' }],
  currentPlan: null, pendingReviews: 2, ...over,
});
const notif = (over: object = {}) => ({ id: 'n1', type: 'WORKOUT_ASSIGNED', title: 'Nuevo entrenamiento', message: 'Tienes Full Body', data: { assignmentId: 'a1' }, readAt: null, createdAt: '2026-11-18T10:00:00Z', ...over });
const page = (data: unknown[]) => json({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1 } });

interface Call { method: string; path: string; query: URLSearchParams; body: any }
function mockApi(me: unknown, handler: (c: Call) => Response | undefined) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const raw = init?.body;
    const c: Call = { method: (init as RequestInit | undefined)?.method ?? 'GET', path: url.pathname.replace('/api/v1', ''), query: url.searchParams, body: typeof raw === 'string' ? JSON.parse(raw) : undefined };
    calls.push(c);
    if (c.path === '/users/me') return json({ data: me });
    if (c.path === '/notifications/unread-count') return json({ data: { count: 0 } });
    const r = handler(c);
    if (!r) throw new Error(`Sin mock para ${c.method} ${c.path}`);
    return r;
  });
  return calls;
}
afterEach(() => vi.restoreAllMocks());

const renderRoute = (pattern: string, element: ReactElement, route: string) =>
  renderWithProviders(null as never, { route, routes: <Route path={pattern} element={element} /> });

describe('dashboard de la Coach (HU-14)', () => {
  it('muestra KPIs, nutrición y la lista en riesgo con su motivo', async () => {
    mockApi(coach, (c) => (c.path === '/coach/dashboard' ? json({ data: dashboard() }) : undefined));
    renderWithProviders(<CoachDashboardPage />, { route: '/coach/dashboard' });
    expect(await screen.findByText('8 de 10 completados')).toBeInTheDocument();
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0);
    expect(screen.getByText('2 de 4')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /completados y programados/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', '/coach/food-reviews');
    expect(screen.getByRole('link', { name: 'Ana Ruiz' })).toHaveAttribute('href', `/coach/users/${UID}`);
    expect(screen.getByText('Lleva 9 días sin entrenar')).toBeInTheDocument();
    expect(screen.getByText('Sin seguimientos registrados')).toBeInTheDocument();
  });

  it('cambiar el período vuelve a pedir los datos con ese rango', async () => {
    const calls = mockApi(coach, (c) => (c.path === '/coach/dashboard' ? json({ data: dashboard() }) : undefined));
    renderWithProviders(<CoachDashboardPage />, { route: '/coach/dashboard' });
    await screen.findByText('8 de 10 completados');
    expect(calls.find((c) => c.path === '/coach/dashboard')!.query.get('range')).toBe('30');
    await userEvent.selectOptions(screen.getByLabelText('Período'), '7');
    await waitFor(() => expect(calls.filter((c) => c.path === '/coach/dashboard').some((c) => c.query.get('range') === '7')).toBe(true));
  });

  it('sin entrenamientos no inventa un 0 %: muestra estado vacío y guion', async () => {
    mockApi(coach, (c) => (c.path === '/coach/dashboard' ? json({ data: dashboard({ workouts: adherence({ scheduled: 0, completed: 0, partial: 0, skipped: 0, adherence: null, partialRate: null }), atRisk: [], atRiskTotal: 0 }) }) : undefined));
    renderWithProviders(<CoachDashboardPage />, { route: '/coach/dashboard' });
    expect(await screen.findByText('Aún no hay datos')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Todo en orden')).toBeInTheDocument();
  });

  it('avisa cuántas alertas más hay y registra un seguimiento con sus motivos', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.path === '/coach/dashboard') return json({ data: dashboard({ atRiskTotal: 12 }) });
      if (c.method === 'POST' && c.path === `/coach/users/${UID}/follow-ups`) return json({ data: { id: 'f2' } }, 201);
    });
    renderWithProviders(<CoachDashboardPage />, { route: '/coach/dashboard' });
    expect(await screen.findByText(/Y 11 más/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar seguimiento' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar seguimiento' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument(); // texto vacío: no se envía
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.type(within(dialog).getByLabelText('¿Qué hiciste?'), 'Le escribí por mensaje');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar seguimiento' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ note: 'Le escribí por mensaje', reasons: ['INACTIVITY'] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('error de carga con opción de reintentar', async () => {
    mockApi(coach, (c) => (c.path === '/coach/dashboard' ? json({ statusCode: 500, message: 'x', error: 'e' }, 500) : undefined));
    renderWithProviders(<CoachDashboardPage />, { route: '/coach/dashboard' });
    expect(await screen.findByText('No pudimos cargar el dashboard.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('gráfico de adherencia', () => {
  it('ofrece una tabla equivalente para lectores de pantalla', () => {
    renderWithProviders(<AdherenceChart points={[{ label: '11-01', date: '2026-11-01', scheduled: 4, completed: 2, adherence: 50 }, { label: '11-08', date: '2026-11-08', scheduled: 0, completed: 0, adherence: null }]} />);
    expect(screen.getByRole('table', { hidden: true })).toBeInTheDocument();
    expect(screen.getByText('sin datos')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });
});

describe('inicio de la usuaria (HU-16)', () => {
  const home = (over: object = {}) => ({
    firstName: 'Ana', weekly: { completed: 2, goal: 3 }, next: null, todayDone: false,
    nutrition: { planName: 'Definición', plannedMealsToday: 4, loggedToday: 1 }, unreadNotifications: 2, ...over,
  });

  it('saluda, muestra el avance semanal, la alimentación y las notificaciones nuevas', async () => {
    mockApi(member, (c) => (c.path === '/dashboard' ? json({ data: home() }) : undefined));
    renderWithProviders(<UserDashboardPage />, { route: '/app/dashboard' });
    expect(await screen.findByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Meta semanal de entrenamientos' })).toHaveAttribute('aria-valuenow', '2');
    expect(screen.getByText('Te falta 1 para tu meta.')).toBeInTheDocument();
    expect(screen.getByText('Hoy: 1 de 4 comidas registradas.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /2 notificaciones nuevas/ })).toHaveAttribute('href', '/app/notifications');
    expect(screen.getByText('No tienes entrenamientos programados')).toBeInTheDocument();
  });

  it('sin plan invita a llevar el diario y no muestra notificaciones si no hay', async () => {
    mockApi(member, (c) => (c.path === '/dashboard' ? json({ data: home({ nutrition: { planName: null, plannedMealsToday: 0, loggedToday: 0 }, unreadNotifications: 0, weekly: { completed: 3, goal: 3 }, todayDone: true }) }) : undefined));
    renderWithProviders(<UserDashboardPage />, { route: '/app/dashboard' });
    expect(await screen.findByText('Aún no tienes un plan de alimentación')).toBeInTheDocument();
    expect(screen.queryByText(/notificaci/)).not.toBeInTheDocument();
    expect(screen.getByText(/Meta de la semana cumplida/)).toBeInTheDocument();
    expect(screen.getByText('Hoy ya entrenaste')).toBeInTheDocument();
  });
});

describe('notificaciones (HU-25)', () => {
  it('lista, marca como leída al abrir y navega al recurso', async () => {
    const calls = mockApi(member, (c) => {
      if (c.path === '/notifications') return page([notif(), notif({ id: 'n2', title: 'Leída', readAt: '2026-11-17T10:00:00Z' })]);
      if (c.method === 'POST' && c.path === '/notifications/n1/read') return json({ data: notif({ readAt: '2026-11-18T11:00:00Z' }) });
    });
    renderWithProviders(<NotificationsPage />, { route: '/app/notifications' });
    await userEvent.click(await screen.findByRole('button', { name: /Nuevo entrenamiento/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/notifications/n1/read')).toBe(true));
    expect(screen.getByTestId('location')).toHaveTextContent('/app/workouts/a1');
  });

  it('abrir una ya leída no vuelve a marcarla', async () => {
    const calls = mockApi(member, (c) => (c.path === '/notifications' ? page([notif({ readAt: '2026-11-17T10:00:00Z' })]) : undefined));
    renderWithProviders(<NotificationsPage />, { route: '/app/notifications' });
    await userEvent.click(await screen.findByRole('button', { name: /Nuevo entrenamiento/ }));
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('marcar todas como leídas y filtrar solo no leídas', async () => {
    const calls = mockApi(member, (c) => {
      if (c.path === '/notifications') return page([notif()]);
      if (c.method === 'POST' && c.path === '/notifications/read-all') return json({ data: { updated: 1 } });
    });
    renderWithProviders(<NotificationsPage />, { route: '/app/notifications' });
    await screen.findByText('Nuevo entrenamiento');
    await userEvent.click(screen.getByRole('button', { name: /Marcar todas/ }));
    await waitFor(() => expect(calls.some((c) => c.path === '/notifications/read-all')).toBe(true));
    await userEvent.click(screen.getByLabelText('Solo no leídas'));
    await waitFor(() => expect(calls.some((c) => c.path === '/notifications' && c.query.get('unread') === 'true')).toBe(true));
  });

  it('estado vacío', async () => {
    mockApi(member, (c) => (c.path === '/notifications' ? page([]) : undefined));
    renderWithProviders(<NotificationsPage />, { route: '/app/notifications' });
    expect(await screen.findByText('Aún no tienes notificaciones')).toBeInTheDocument();
  });

  it('la campana muestra el contador de no leídas y lo tope en 9+', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({ data: { count: 14 } }));
    renderWithProviders(<NotificationBell to="/app/notifications" />);
    expect(await screen.findByRole('link', { name: 'Notificaciones, 14 sin leer' })).toBeInTheDocument();
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('destinos según rol: la Coach va a revisión de comidas; la usuaria al diario', () => {
    expect(targetOf(notif({ type: 'MEAL_LOG_PENDING_REVIEW' }) as any, true)).toBe('/coach/food-reviews');
    expect(targetOf(notif({ type: 'MEAL_LOG_PENDING_REVIEW' }) as any, false)).toBeNull();
    expect(targetOf(notif({ type: 'MEAL_LOG_REVIEWED' }) as any, false)).toBe('/app/nutrition/diary');
    expect(targetOf(notif({ type: 'NUTRITION_PLAN_ASSIGNED' }) as any, false)).toBe('/app/nutrition/my-plan');
    expect(targetOf(notif({ type: 'WORKOUT_RESCHEDULED', data: null }) as any, false)).toBe('/app/calendar');
  });
});

describe('perfil, privacidad y contraseña (HU-24, HU-28)', () => {
  it('aceptar la política desde el perfil registra el consentimiento y oculta el botón', async () => {
    const calls = mockApi({ ...member, privacyConsentAt: null }, (c) => (c.method === 'POST' && c.path === '/users/me/privacy-consent' ? json({ data: { ...member, privacyConsentAt: '2026-11-18T12:00:00.000Z' } }) : undefined));
    renderWithProviders(<ProfilePage />, { route: '/app/profile' });
    expect(await screen.findByText(/necesitas aceptar esta política/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Acepto la política de privacidad' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/users/me/privacy-consent')).toBe(true));
    expect(await screen.findByText(/Aceptaste la política el/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acepto la política de privacidad' })).not.toBeInTheDocument();
  });

  it('el banner aparece solo sin consentimiento', async () => {
    mockApi({ ...member, privacyConsentAt: null }, () => undefined);
    const { unmount } = renderWithProviders(<ConsentBanner />, { route: '/app/dashboard' });
    expect(await screen.findByRole('region', { name: 'Política de privacidad' })).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();
    mockApi(member, () => undefined);
    renderWithProviders(<ConsentBanner />, { route: '/app/dashboard' });
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: 'Política de privacidad' })).not.toBeInTheDocument();
  });

  it('edita el nombre y envía solo nombre, apellido y zona horaria', async () => {
    const calls = mockApi(member, (c) => (c.method === 'PATCH' && c.path === '/users/me' ? json({ data: { ...member, firstName: 'Ana María' } }) : undefined));
    renderWithProviders(<ProfilePage />, { route: '/app/profile' });
    const name = await screen.findByLabelText('Nombre');
    await userEvent.clear(name);
    await userEvent.type(name, ' Ana María ');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ firstName: 'Ana María', lastName: 'Coach', timezone: 'America/Bogota' });
    expect(await screen.findByText('Perfil actualizado.')).toBeInTheDocument();
  });

  it('cambiar contraseña valida coincidencia, envía y limpia el formulario', async () => {
    const calls = mockApi(member, (c) => (c.method === 'POST' && c.path === '/auth/change-password' ? json({ data: { message: 'ok' } }) : undefined));
    renderWithProviders(<ProfilePage />, { route: '/app/profile' });
    await userEvent.type(await screen.findByLabelText('Contraseña actual'), 'Secreta123');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave456');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'Distinta789');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByText('Las contraseñas no coinciden')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await userEvent.clear(screen.getByLabelText('Confirmar nueva contraseña'));
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'NuevaClave456');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ currentPassword: 'Secreta123', newPassword: 'NuevaClave456', confirmPassword: 'NuevaClave456' });
    expect(await screen.findByText(/Contraseña actualizada/)).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
  });

  it('muestra el error del servidor si la contraseña actual es incorrecta', async () => {
    mockApi(member, (c) => (c.method === 'POST' && c.path === '/auth/change-password' ? json({ statusCode: 400, message: 'La contraseña actual no es correcta', error: 'Bad Request' }, 400) : undefined));
    renderWithProviders(<ProfilePage />, { route: '/app/profile' });
    await userEvent.type(await screen.findByLabelText('Contraseña actual'), 'Mala12345');
    await userEvent.type(screen.getByLabelText('Nueva contraseña'), 'NuevaClave456');
    await userEvent.type(screen.getByLabelText('Confirmar nueva contraseña'), 'NuevaClave456');
    await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    expect(await screen.findByText('La contraseña actual no es correcta')).toBeInTheDocument();
  });
});

describe('horarios de comida (HU-23)', () => {
  const schedules = [
    { mealType: 'BREAKFAST', scheduledTime: '08:00', reminderEnabled: false, isDefault: true },
    { mealType: 'LUNCH', scheduledTime: '12:15', reminderEnabled: true, isDefault: false },
  ];

  it('lista los horarios y guarda el cambio de hora y recordatorio por tipo de comida', async () => {
    const calls = mockApi(member, (c) => {
      if (c.path === '/food-schedules' && c.method === 'GET') return json({ data: schedules });
      if (c.method === 'PUT' && c.path === '/food-schedules/BREAKFAST') return json({ data: { ...schedules[0], scheduledTime: '07:30', reminderEnabled: true, isDefault: false } });
    });
    renderWithProviders(<SchedulesPage />, { route: '/app/nutrition/schedules' });
    const time = await screen.findByLabelText('Desayuno');
    expect(screen.getByLabelText('Almuerzo')).toHaveValue('12:15');
    await userEvent.clear(time);
    await userEvent.type(time, '07:30');
    await userEvent.click(screen.getByLabelText(/Recordarme desayuno/));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar horario de desayuno' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ scheduledTime: '07:30', reminderEnabled: true });
    expect(await screen.findByText('Guardado.')).toBeInTheDocument();
  });

  it('aclara que los recordatorios aún no se envían automáticamente', async () => {
    mockApi(member, (c) => (c.path === '/food-schedules' ? json({ data: schedules }) : undefined));
    renderWithProviders(<SchedulesPage />, { route: '/app/nutrition/schedules' });
    expect(await screen.findByText(/todavía no enviamos avisos automáticos/)).toBeInTheDocument();
  });

  it('un horario ya guardado y sin cambios no se puede volver a guardar', async () => {
    mockApi(member, (c) => (c.path === '/food-schedules' ? json({ data: schedules }) : undefined));
    renderWithProviders(<SchedulesPage />, { route: '/app/nutrition/schedules' });
    await screen.findByLabelText('Almuerzo');
    expect(screen.getByRole('button', { name: 'Guardar horario de almuerzo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar horario de desayuno' })).toBeEnabled();
  });
});

describe('configuración de la Coach (HU-15)', () => {
  const risk = { inactivityDays: 7, consecutiveMissed: 3, noFoodLogDays: 5, adherenceDropPoints: 25 };

  it('carga los umbrales y guarda los nuevos como números', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.path === '/coach/settings/risk' && c.method === 'GET') return json({ data: risk });
      if (c.path === '/coach/settings/risk' && c.method === 'PUT') return json({ data: { ...risk, inactivityDays: 10 } });
    });
    renderWithProviders(<SettingsPage />, { route: '/coach/settings' });
    const input = await screen.findByLabelText('Días sin entrenar');
    expect(input).toHaveValue(7);
    await userEvent.clear(input);
    await userEvent.type(input, '10');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar umbrales' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ ...risk, inactivityDays: 10 });
    expect(await screen.findByText(/Umbrales guardados/)).toBeInTheDocument();
  });

  it('rechaza valores fuera de rango sin enviar', async () => {
    const calls = mockApi(coach, (c) => (c.path === '/coach/settings/risk' ? json({ data: risk }) : undefined));
    renderWithProviders(<SettingsPage />, { route: '/coach/settings' });
    const input = await screen.findByLabelText('Días sin entrenar');
    await userEvent.clear(input);
    await userEvent.type(input, '1');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar umbrales' }));
    expect(await screen.findByText('Mínimo 3 días')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('restablecer deja los valores por defecto en el formulario sin guardar', async () => {
    mockApi(coach, (c) => (c.path === '/coach/settings/risk' ? json({ data: { ...risk, inactivityDays: 14 } }) : undefined));
    renderWithProviders(<SettingsPage />, { route: '/coach/settings' });
    expect(await screen.findByLabelText('Días sin entrenar')).toHaveValue(14);
    await userEvent.click(screen.getByRole('button', { name: 'Restablecer valores por defecto' }));
    expect(screen.getByLabelText('Días sin entrenar')).toHaveValue(7);
  });
});

describe('vista 360 de una usuaria (HU-08, HU-26, HU-27)', () => {
  const handler = (c: Call) => {
    if (c.path === `/coach/users/${UID}/statistics`) return json({ data: stats() });
    if (c.path === '/workout-assignments') return json({ data: [{ id: 'a1', scheduledDate: '2026-11-15', scheduledTime: null, status: 'COMPLETED', workout: { id: 'w', title: 'Full Body', durationMinutes: 50, difficulty: 'BEGINNER', category: 'FULL_BODY', videoId: 'dQw4w9WgXcQ', isPublished: true }, userId: UID, userName: 'Ana Ruiz', hasSession: true, hasFeedback: true }] });
    if (c.path === `/coach/users/${UID}/nutrition-plans`) return json({ data: [{ id: 'pa1', userId: UID, userName: 'Ana Ruiz', planId: 'p1', planName: 'Definición', versionId: 'v1', versionNumber: 2, startDate: '2026-11-01', endDate: null, status: 'ACTIVE', phase: 'CURRENT', createdAt: '' }] });
  };

  it('reúne resumen, alertas, seguimientos, entrenamientos y planes', async () => {
    const calls = mockApi(coach, handler);
    renderWithProviders(<UserOverview userId={UID} userName="Ana Ruiz" timezone="America/Bogota" />);
    expect(await screen.findByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Lleva 9 días sin entrenar')).toBeInTheDocument();
    expect(screen.getByText('Le escribí')).toBeInTheDocument();
    expect(screen.getByText(/Full Body/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Definición' })).toHaveAttribute('href', '/coach/nutrition-plans/p1');
    expect(screen.getByRole('link', { name: 'Revisar' })).toHaveAttribute('href', `/coach/food-reviews?userId=${UID}`);
    const wk = calls.find((c) => c.path === '/workout-assignments')!;
    expect(wk.query.get('userId')).toBe(UID);
  });

  it('sin alertas lo dice y permite igualmente registrar seguimiento', async () => {
    mockApi(coach, (c) => (c.path === `/coach/users/${UID}/statistics` ? json({ data: stats({ risk: [], followUps: [] }) }) : handler(c)));
    renderWithProviders(<UserOverview userId={UID} userName="Ana Ruiz" timezone="America/Bogota" />);
    expect(await screen.findByText('Sin alertas por ahora.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar seguimiento' }));
    expect(screen.getByRole('dialog', { name: /Seguimiento de Ana Ruiz/ })).toBeInTheDocument();
  });
});
