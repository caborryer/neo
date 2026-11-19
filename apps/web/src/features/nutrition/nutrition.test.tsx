import type { ReactElement } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { PlanEditorPage } from './PlanEditorPage';
import { PlanDetailPage } from './PlanDetailPage';
import { PlanAssignmentsPage } from './PlanAssignmentsPage';
import { MyPlanPage } from './MyPlanPage';
import { DiaryPage } from '@/features/food-diary/DiaryPage';
import { FoodReviewsPage } from '@/features/food-diary/FoodReviewsPage';
import { coach, json, member, renderWithProviders } from '@/test/utils';
import { addDaysKey, todayInZone } from '@/utils/calendar';

const today = todayInZone('America/Bogota');
const P_ID = '44444444-4444-4444-8444-444444444444';
const V1 = '55555555-5555-4555-8555-555555555555';
const V2 = '66666666-6666-4666-8666-666666666666';
const U_ID = '77777777-7777-4777-8777-777777777777';

const food = (over: object = {}) => ({ id: 'f1', name: 'Avena', quantity: 50, unit: 'GRAMS', notes: null, ...over });
const A_ID = '99999999-9999-4999-8999-999999999999';
const M_ID = '88888888-8888-4888-8888-888888888888';
const meal = (over: object = {}) => ({ id: M_ID, mealType: 'BREAKFAST', title: 'Desayuno', scheduledTime: '07:00', instructions: 'Con calma', foods: [food()], ...over });
const day = (over: object = {}) => ({ id: 'd1', dayNumber: 1, dayName: 'MONDAY', meals: [meal()], ...over });
const version = (over: object = {}) => ({ id: V1, planId: P_ID, versionNumber: 1, notes: 'Tomar agua', publishedAt: null, createdAt: '2026-11-10T00:00:00Z', days: [day()], ...over });
const summary = (over: object = {}) => ({ id: V1, versionNumber: 1, notes: null, publishedAt: null, createdAt: '2026-11-10T00:00:00Z', assignmentCount: 0, ...over });
const planDetail = (over: object = {}) => ({
  id: P_ID, name: 'Plan base', description: 'Semanal', isTemplate: false, isActive: true, latestVersionNumber: 1, hasDraft: true, publishedVersions: 0,
  createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z', versions: [summary()], ...over,
});
const log = (over: object = {}) => ({
  id: 'l1', userId: 'u1', userName: 'Ana Ruiz', plannedMealId: null, plannedMealTitle: null, mealType: 'BREAKFAST', description: 'Avena con banano', imageAssetId: null, imageUrl: null,
  consumedAt: `${today}T12:00:00Z`, date: today, time: '07:00', status: 'DRAFT', coachComment: null, reviewedAt: null, createdAt: '', updatedAt: '', ...over,
});
const page = (data: unknown[]) => json({ data, meta: { page: 1, limit: 10, total: data.length, totalPages: 1 } });

interface Call { method: string; path: string; query: URLSearchParams; body: any; raw?: unknown; headers?: Record<string, string> }
function mockApi(me: unknown, handler: (c: Call) => Response | undefined) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const raw = init?.body;
    const c: Call = {
      method: (init as RequestInit | undefined)?.method ?? 'GET', path: url.pathname.replace('/api/v1', ''), query: url.searchParams,
      body: typeof raw === 'string' ? JSON.parse(raw) : undefined, raw, headers: init?.headers as Record<string, string> | undefined,
    };
    calls.push(c);
    if (c.path === '/users/me') return json({ data: me });
    const r = handler(c);
    if (!r) throw new Error(`Sin mock para ${c.method} ${c.path}`);
    return r;
  });
  return calls;
}
afterEach(() => vi.restoreAllMocks());

const renderRoute = (pattern: string, element: ReactElement, route: string) =>
  renderWithProviders(null as never, { route, routes: <Route path={pattern} element={element} /> });

describe('constructor de planes (HU-11)', () => {
  it('crea un plan con comidas y alimentos y envía el payload normalizado', async () => {
    const calls = mockApi(coach, (c) => (c.method === 'POST' && c.path === '/coach/nutrition-plans' ? json({ data: planDetail() }, 201) : c.path === `/coach/nutrition-plans/${P_ID}` ? json({ data: planDetail() }) : undefined));
    renderWithProviders(<PlanEditorPage />, { route: '/coach/nutrition-plans/create' });

    await userEvent.type(await screen.findByLabelText('Nombre del plan'), '  Plan base ');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar comida' }));
    await userEvent.type(screen.getByLabelText('Alimento 1'), 'Avena');
    await userEvent.type(screen.getByLabelText('Cantidad'), '50');
    await userEvent.type(screen.getByLabelText('Hora sugerida'), '07:00');
    await userEvent.click(screen.getByRole('button', { name: 'Crear plan' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toMatchObject({ name: 'Plan base', isTemplate: false, days: [{ dayName: 'MONDAY', meals: [{ mealType: 'BREAKFAST', title: 'Desayuno', scheduledTime: '07:00', foods: [{ name: 'Avena', quantity: 50, unit: 'GRAMS' }] }] }] });
  });

  it('no envía si falta la cantidad y dice dónde está el problema', async () => {
    const calls = mockApi(coach, () => undefined);
    renderWithProviders(<PlanEditorPage />, { route: '/coach/nutrition-plans/create' });
    await userEvent.type(await screen.findByLabelText('Nombre del plan'), 'Plan');
    await userEvent.click(screen.getByRole('button', { name: 'Agregar comida' }));
    await userEvent.type(screen.getByLabelText('Alimento 1'), 'Avena');
    await userEvent.click(screen.getByRole('button', { name: 'Crear plan' }));

    const alert = await screen.findByText(/Revisa estos puntos/);
    expect(within(alert.closest('[role=alert]') as HTMLElement).getByText(/Lunes · Desayuno · Alimento 1/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('copiar un día a otro duplica sus comidas', async () => {
    mockApi(coach, () => undefined);
    renderWithProviders(<PlanEditorPage />, { route: '/coach/nutrition-plans/create' });
    await userEvent.click(await screen.findByRole('button', { name: 'Agregar comida' }));
    await userEvent.selectOptions(screen.getByLabelText(/Copiar el lunes/), 'TUESDAY');
    await userEvent.click(screen.getByRole('tab', { name: /Mar/ }));
    expect(screen.getByLabelText('Título')).toHaveValue('Desayuno');
  });

  it('editar: carga el borrador y guarda con PUT sobre esa versión', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.path === `/coach/nutrition-plans/${P_ID}/versions/${V1}` && c.method === 'GET') return json({ data: version() });
      if (c.path === `/coach/nutrition-plans/${P_ID}/versions/${V1}` && c.method === 'PUT') return json({ data: version() });
      if (c.path === `/coach/nutrition-plans/${P_ID}` && c.method === 'PATCH') return json({ data: planDetail() });
      if (c.path === `/coach/nutrition-plans/${P_ID}`) return json({ data: planDetail() });
    });
    renderRoute('/coach/nutrition-plans/:id/edit', <PlanEditorPage />, `/coach/nutrition-plans/${P_ID}/edit`);
    expect(await screen.findByLabelText('Nombre del plan')).toHaveValue('Plan base');
    expect(screen.getByLabelText('Alimento 1')).toHaveValue('Avena');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toMatchObject({ notes: 'Tomar agua', days: [{ dayName: 'MONDAY' }] });
  });

  it('si la última versión está publicada ofrece crear una nueva (no se edita lo publicado)', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.path === `/coach/nutrition-plans/${P_ID}/versions` && c.method === 'POST') return json({ data: version({ id: V2, versionNumber: 2 }) }, 201);
      if (c.path === `/coach/nutrition-plans/${P_ID}`) return json({ data: planDetail({ hasDraft: false, versions: [summary({ publishedAt: '2026-11-11T00:00:00Z' })] }) });
    });
    renderRoute('/coach/nutrition-plans/:id/edit', <PlanEditorPage />, `/coach/nutrition-plans/${P_ID}/edit`);
    expect(await screen.findByText('Esta versión ya está publicada')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre del plan')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear nueva versión' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
  });
});

describe('detalle y versionado (HU-11, HU-12)', () => {
  it('un borrador se publica tras confirmar que queda congelado', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.method === 'POST' && c.path.endsWith('/publish')) return json({ data: version({ publishedAt: '2026-11-18T00:00:00Z' }) });
      if (c.path === `/coach/nutrition-plans/${P_ID}/versions/${V1}`) return json({ data: version() });
      if (c.path === `/coach/nutrition-plans/${P_ID}`) return json({ data: planDetail() });
    });
    renderRoute('/coach/nutrition-plans/:id', <PlanDetailPage />, `/coach/nutrition-plans/${P_ID}`);
    expect(await screen.findByText(/Borrador: las usuarias no lo ven/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Asignar/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Publicar versión/ }));
    expect(screen.getByText('congelada')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith(`/versions/${V1}/publish`))).toBe(true));
  });

  it('si el servidor rechaza publicar, lista los motivos', async () => {
    mockApi(coach, (c) => {
      if (c.method === 'POST') return json({ statusCode: 400, message: 'La versión no está lista para publicarse', error: 'Bad Request', details: [{ field: 'days', message: '"Desayuno" (MONDAY) no tiene alimentos' }] }, 400);
      if (c.path.includes('/versions/')) return json({ data: version() });
      return json({ data: planDetail() });
    });
    renderRoute('/coach/nutrition-plans/:id', <PlanDetailPage />, `/coach/nutrition-plans/${P_ID}`);
    await userEvent.click(await screen.findByRole('button', { name: /Publicar versión/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(await screen.findByText(/no tiene alimentos/)).toBeInTheDocument();
    expect(screen.getByText('La versión no está lista para publicarse')).toBeInTheDocument();
  });

  it('una versión publicada es de solo lectura y permite asignar y crear otra versión', async () => {
    mockApi(coach, (c) => {
      if (c.path.includes('/versions/')) return json({ data: version({ publishedAt: '2026-11-11T00:00:00Z' }) });
      return json({ data: planDetail({ hasDraft: false, publishedVersions: 1, versions: [summary({ publishedAt: '2026-11-11T00:00:00Z', assignmentCount: 2 })] }) });
    });
    renderRoute('/coach/nutrition-plans/:id', <PlanDetailPage />, `/coach/nutrition-plans/${P_ID}`);
    expect(await screen.findByText(/no se puede modificar/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publicar versión/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Asignar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nueva versión/ })).toBeInTheDocument();
    expect(screen.getByText(/2 asignaciones/)).toBeInTheDocument();
    expect(await screen.findByText('Avena')).toBeInTheDocument();
  });
});

describe('asignación de planes (HU-12)', () => {
  const published = planDetail({ hasDraft: false, publishedVersions: 1, versions: [summary({ publishedAt: '2026-11-11T00:00:00Z' })] });
  const users = { data: [{ id: U_ID, firstName: 'Ana', lastName: 'Ruiz', email: 'a@b.co', status: 'ACTIVE', timezone: 'America/Bogota', weeklyGoal: 3, accessExpiresAt: null, activatedAt: null, createdAt: '' }], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } };
  const assignment = (over: object = {}) => ({ id: 'a1', userId: U_ID, userName: 'Ana Ruiz', planId: P_ID, planName: 'Plan base', versionId: V1, versionNumber: 1, startDate: today, endDate: null, status: 'ACTIVE', phase: 'CURRENT', createdAt: '', ...over });

  it('asigna a las usuarias elegidas con su vigencia y muestra a quién se omitió', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.method === 'POST') return json({ data: { created: [assignment()], skipped: [{ userId: U_ID, reason: 'La usuaria no tiene el acceso activo' }] } }, 201);
      if (c.path === `/coach/nutrition-plans/${P_ID}/assignments`) return json({ data: [assignment()] });
      if (c.path === '/coach/users') return json(users);
      if (c.path === `/coach/nutrition-plans/${P_ID}`) return json({ data: published });
    });
    renderRoute('/coach/nutrition-plans/:id/assignments', <PlanAssignmentsPage />, `/coach/nutrition-plans/${P_ID}/assignments`);
    await userEvent.click(await screen.findByLabelText('Ana Ruiz'));
    await userEvent.type(screen.getByLabelText('Fin (opcional)'), addDaysKey(today, 30));
    await userEvent.click(screen.getByRole('button', { name: 'Asignar plan' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ versionId: V1, userIds: [U_ID], startDate: today, endDate: addDaysKey(today, 30) });
    expect(await screen.findByText(/1 asignación creada/)).toBeInTheDocument();
    expect(screen.getByText(/Ana Ruiz: La usuaria no tiene el acceso activo/)).toBeInTheDocument();
  });

  it('el botón se bloquea sin usuarias y sin versión publicada no hay formulario', async () => {
    mockApi(coach, (c) => {
      if (c.path.endsWith('/assignments')) return json({ data: [] });
      if (c.path === '/coach/users') return json(users);
      return json({ data: published });
    });
    renderRoute('/coach/nutrition-plans/:id/assignments', <PlanAssignmentsPage />, `/coach/nutrition-plans/${P_ID}/assignments`);
    expect(await screen.findByRole('button', { name: 'Asignar plan' })).toBeDisabled();
  });

  it('sin versiones publicadas lo explica', async () => {
    mockApi(coach, (c) => (c.path.endsWith('/assignments') ? json({ data: [] }) : c.path === '/coach/users' ? json(users) : json({ data: planDetail() })));
    renderRoute('/coach/nutrition-plans/:id/assignments', <PlanAssignmentsPage />, `/coach/nutrition-plans/${P_ID}/assignments`);
    expect(await screen.findByText('No hay versiones publicadas')).toBeInTheDocument();
  });

  it('finaliza una asignación vigente', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.method === 'POST' && c.path === '/coach/nutrition-assignments/a1/end') return json({ data: assignment({ status: 'ENDED', phase: 'ENDED' }) });
      if (c.path.endsWith('/assignments')) return json({ data: [assignment()] });
      if (c.path === '/coach/users') return json(users);
      return json({ data: published });
    });
    renderRoute('/coach/nutrition-plans/:id/assignments', <PlanAssignmentsPage />, `/coach/nutrition-plans/${P_ID}/assignments`);
    await userEvent.click(await screen.findByRole('button', { name: 'Finalizar plan de Ana Ruiz' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/coach/nutrition-assignments/a1/end')).toBe(true));
  });
});

describe('Mi plan (HU-21)', () => {
  const current = { assignmentId: 'a1', planName: 'Plan base', planDescription: null, versionNumber: 2, notes: 'Hidratarse', startDate: '2026-11-01', endDate: null, days: [day(), day({ id: 'd2', dayNumber: 2, dayName: 'TUESDAY', meals: [meal({ id: 'm2', title: 'Almuerzo', mealType: 'LUNCH', foods: [food({ id: 'f2', name: 'Pollo', quantity: 150 })] })] })] };

  it('muestra el plan por días, en solo lectura, sin controles de edición', async () => {
    mockApi(member, (c) => (c.path === '/nutrition/my-plan' ? json({ data: { current, upcoming: null } }) : undefined));
    renderWithProviders(<MyPlanPage />, { route: '/app/nutrition/my-plan' });
    expect(await screen.findByText('Plan base')).toBeInTheDocument();
    expect(screen.getByText('Hidratarse')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Martes/ }));
    expect(screen.getByText('Pollo')).toBeInTheDocument();
    expect(screen.getByText(/150 g/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar|guardar|agregar/i })).not.toBeInTheDocument();
  });

  it('sin plan activo: estado vacío con el próximo plan si existe', async () => {
    mockApi(member, (c) => (c.path === '/nutrition/my-plan' ? json({ data: { current: null, upcoming: { planName: 'Plan nuevo', startDate: '2999-01-01' } } }) : undefined));
    renderWithProviders(<MyPlanPage />, { route: '/app/nutrition/my-plan' });
    expect(await screen.findByText('Aún no tienes un plan activo')).toBeInTheDocument();
    expect(screen.getByText(/Plan nuevo/)).toBeInTheDocument();
  });

  it('pide el plan vigente en la fecha de hoy de su zona horaria', async () => {
    const calls = mockApi(member, () => json({ data: { current: null, upcoming: null } }));
    renderWithProviders(<MyPlanPage />, { route: '/app/nutrition/my-plan' });
    await screen.findByText('Aún no tienes un plan activo');
    expect(calls.find((c) => c.path === '/nutrition/my-plan')!.query.get('date')).toBe(today);
  });

  it('el historial se carga solo al pedirlo', async () => {
    const calls = mockApi(member, (c) => {
      if (c.path === '/nutrition/my-plan/history') return json({ data: [{ id: 'a0', planName: 'Plan viejo', versionNumber: 1, startDate: '2026-09-01', endDate: '2026-10-31', status: 'ACTIVE', phase: 'PAST' }] });
      return json({ data: { current: null, upcoming: null } });
    });
    renderWithProviders(<MyPlanPage />, { route: '/app/nutrition/my-plan' });
    await screen.findByText('Aún no tienes un plan activo');
    expect(calls.some((c) => c.path.endsWith('/history'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /Ver historial/ }));
    expect(await screen.findByText('Plan viejo')).toBeInTheDocument();
    expect(screen.getByText('Vencida')).toBeInTheDocument();
  });
});

describe('diario alimenticio (HU-22)', () => {
  const planWithToday = () => {
    const names = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const name = names[new Date(`${today}T12:00:00`).getDay()];
    return { current: { assignmentId: 'a1', planName: 'Plan', planDescription: null, versionNumber: 1, notes: null, startDate: '2026-01-01', endDate: null, days: [day({ dayName: name })] }, upcoming: null };
  };

  it('registra una comida del plan: envía fecha local, tipo y la comida del plan relacionada', async () => {
    const calls = mockApi(member, (c) => {
      if (c.path === '/meal-logs' && c.method === 'POST') return json({ data: log() }, 201);
      if (c.path === '/meal-logs') return json({ data: [] });
      if (c.path === '/nutrition/my-plan') return json({ data: planWithToday() });
    });
    renderWithProviders(<DiaryPage />, { route: '/app/nutrition/diary' });
    expect(await screen.findByText(/Plan: Desayuno/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Registrar desayuno' }));
    await userEvent.type(screen.getByLabelText('¿Qué comiste?'), 'Avena con banano');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/meal-logs')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ mealType: 'BREAKFAST', description: 'Avena con banano', date: today, time: null, plannedMealId: M_ID, imageAssetId: null });
    expect(calls.some((c) => c.path.endsWith('/submit'))).toBe(false); // solo borrador
  });

  it('"Enviar a mi coach" guarda y luego envía', async () => {
    const calls = mockApi(member, (c) => {
      if (c.path === '/meal-logs/l1/submit') return json({ data: log({ status: 'SUBMITTED' }) });
      if (c.path === '/meal-logs' && c.method === 'POST') return json({ data: log() }, 201);
      if (c.path === '/meal-logs') return json({ data: [] });
      if (c.path === '/nutrition/my-plan') return json({ data: { current: null, upcoming: null } });
    });
    renderWithProviders(<DiaryPage />, { route: '/app/nutrition/diary' });
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar almuerzo' }));
    await userEvent.type(screen.getByLabelText('¿Qué comiste?'), 'Pollo con arroz');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar a mi coach' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/meal-logs/l1/submit')).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && c.path === '/meal-logs')!.body).toMatchObject({ mealType: 'LUNCH', plannedMealId: null });
  });

  it('un registro vacío no se envía al servidor', async () => {
    const calls = mockApi(member, (c) => (c.path === '/meal-logs' && c.method === 'GET' ? json({ data: [] }) : c.path === '/nutrition/my-plan' ? json({ data: { current: null, upcoming: null } }) : undefined));
    renderWithProviders(<DiaryPage />, { route: '/app/nutrition/diary' });
    await userEvent.click(await screen.findByRole('button', { name: 'Registrar cena' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByText('Describe lo que comiste o agrega una foto')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('enviado o revisado no se puede editar; con cambios pedidos sí y muestra el comentario de la Coach', async () => {
    mockApi(member, (c) => {
      if (c.path === '/meal-logs') {
        return json({ data: [
          log({ id: 'l1', mealType: 'BREAKFAST', status: 'SUBMITTED' }),
          log({ id: 'l2', mealType: 'LUNCH', status: 'REVIEWED', coachComment: '¡Muy bien!', description: 'Ensalada' }),
          log({ id: 'l3', mealType: 'DINNER', status: 'NEEDS_CHANGES', coachComment: 'Falta la porción', description: 'Sopa' }),
        ] });
      }
      if (c.path === '/nutrition/my-plan') return json({ data: { current: null, upcoming: null } });
    });
    renderWithProviders(<DiaryPage />, { route: '/app/nutrition/diary' });
    expect(await screen.findByText('¡Muy bien!')).toBeInTheDocument();
    expect(screen.getByText('Falta la porción')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar registro de desayuno' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar registro de almuerzo' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar registro de cena' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar'.replace('Reenviar', 'Enviar a mi coach el registro de cena') })).toBeInTheDocument();
  });

  it('un borrador se puede eliminar', async () => {
    const calls = mockApi(member, (c) => {
      if (c.method === 'DELETE') return new Response(null, { status: 204 });
      if (c.path === '/meal-logs') return json({ data: [log()] });
      if (c.path === '/nutrition/my-plan') return json({ data: { current: null, upcoming: null } });
    });
    renderWithProviders(<DiaryPage />, { route: '/app/nutrition/diary' });
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar borrador de desayuno' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/meal-logs/l1')).toBe(true));
  });

  it('pide los registros de la semana completa y no deja elegir días futuros', async () => {
    const calls = mockApi(member, (c) => (c.path === '/meal-logs' ? json({ data: [] }) : json({ data: { current: null, upcoming: null } })));
    renderWithProviders(<DiaryPage />, { route: '/app/nutrition/diary' });
    await screen.findByText(/Aún no registras nada/);
    const q = calls.find((c) => c.path === '/meal-logs')!.query;
    expect(q.get('from')! <= today && q.get('to')! >= today).toBe(true);
    const future = addDaysKey(today, 1);
    const sunday = addDaysKey(q.get('from')!, 6);
    if (future <= sunday) expect(screen.getAllByRole('button', { pressed: false }).some((b) => b.hasAttribute('disabled'))).toBe(true);
  });

  describe('foto', () => {
    const open = async () => {
      const calls = mockApi(member, (c) => {
        if (c.path === '/media/images') return json({ data: { id: A_ID, url: `/api/v1/media/${A_ID}`, mimeType: 'image/jpeg', sizeBytes: 10 } }, 201);
        if (c.path === '/meal-logs' && c.method === 'POST') return json({ data: log() }, 201);
        if (c.path === '/meal-logs') return json({ data: [] });
        return json({ data: { current: null, upcoming: null } });
      });
      renderWithProviders(<DiaryPage />, { route: '/app/nutrition/diary' });
      await userEvent.click(await screen.findByRole('button', { name: 'Registrar desayuno' }));
      return calls;
    };

    it('rechaza formatos no permitidos y fotos pesadas sin llamar al servidor', async () => {
      const calls = await open();
      const input = screen.getByLabelText('Elegir foto de la comida');
      await userEvent.upload(input, new File(['x'], 'doc.pdf', { type: 'application/pdf' }), { applyAccept: false });
      expect(await screen.findByText(/JPG, PNG o WebP\./)).toBeInTheDocument();
      const big = new File([new Uint8Array(6 * 1024 * 1024)], 'grande.jpg', { type: 'image/jpeg' });
      await userEvent.upload(input, big);
      expect(await screen.findByText(/pesa más de 5 MB/)).toBeInTheDocument();
      expect(calls.some((c) => c.path === '/media/images')).toBe(false);
    });

    it('sube la foto como multipart (sin Content-Type JSON) y la envía con el registro', async () => {
      const calls = await open();
      await userEvent.upload(screen.getByLabelText('Elegir foto de la comida'), new File(['abc'], 'comida.jpg', { type: 'image/jpeg' }));
      expect(await screen.findByAltText('Foto de tu comida')).toBeInTheDocument();
      const up = calls.find((c) => c.path === '/media/images')!;
      expect(up.raw).toBeInstanceOf(FormData);
      expect(Object.keys(up.headers ?? {})).not.toContain('Content-Type');
      expect(up.headers).toMatchObject({ 'X-Requested-With': 'neo-web' });

      await userEvent.click(screen.getByRole('button', { name: 'Guardar borrador' })); // solo foto, sin descripción: válido
      await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/meal-logs')).toBe(true));
      expect(calls.find((c) => c.method === 'POST' && c.path === '/meal-logs')!.body).toMatchObject({ imageAssetId: A_ID, description: '' });
    });
  });
});

describe('revisión de la Coach (HU-13)', () => {
  const submitted = log({ status: 'SUBMITTED', imageUrl: '/api/v1/media/a1', imageAssetId: 'a1', plannedMealTitle: 'Desayuno' });
  const setup = (extra?: (c: Call) => Response | undefined) =>
    mockApi(coach, (c) => {
      const r = extra?.(c);
      if (r) return r;
      if (c.path === '/coach/meal-logs') return page([submitted]);
      if (c.path === '/coach/users') return page([]);
    });

  it('arranca en pendientes y muestra foto, descripción y comida del plan', async () => {
    const calls = setup();
    renderWithProviders(<FoodReviewsPage />, { route: '/coach/food-reviews' });
    expect(await screen.findByText('Avena con banano')).toBeInTheDocument();
    expect(screen.getByText(/Plan: Desayuno/)).toBeInTheDocument();
    expect(screen.getByAltText(/Foto de desayuno de Ana Ruiz/)).toHaveAttribute('src', '/api/v1/media/a1');
    expect(calls.find((c) => c.path === '/coach/meal-logs')!.query.get('status')).toBe('SUBMITTED');
  });

  it('aprobar no exige comentario', async () => {
    const calls = setup((c) => (c.path === '/coach/meal-logs/l1/review' ? json({ data: log({ status: 'REVIEWED' }) }) : undefined));
    renderWithProviders(<FoodReviewsPage />, { route: '/coach/food-reviews' });
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar registro de Ana Ruiz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/coach/meal-logs/l1/review')).toBe(true));
    expect(calls.find((c) => c.path.endsWith('/review'))!.body).toEqual({ status: 'REVIEWED', comment: null });
  });

  it('pedir cambios exige una observación y no llama al servidor sin ella', async () => {
    const calls = setup((c) => (c.path.endsWith('/review') ? json({ data: log({ status: 'NEEDS_CHANGES' }) }) : undefined));
    renderWithProviders(<FoodReviewsPage />, { route: '/coach/food-reviews' });
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar registro de Ana Ruiz' }));
    await userEvent.click(screen.getByLabelText(/Solicitar cambios/));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    expect(await screen.findByText('Explica qué debe cambiar la usuaria')).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/review'))).toBe(false);

    await userEvent.type(screen.getByLabelText(/Observación/), 'Falta la porción');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/review'))).toBe(true));
    expect(calls.find((c) => c.path.endsWith('/review'))!.body).toEqual({ status: 'NEEDS_CHANGES', comment: 'Falta la porción' });
  });

  it('un conflicto (ya revisado por otra vía) se muestra sin cerrar el diálogo', async () => {
    setup((c) => (c.path.endsWith('/review') ? json({ statusCode: 409, message: 'Solo se pueden revisar registros enviados y aún sin revisar', error: 'Conflict' }, 409) : undefined));
    renderWithProviders(<FoodReviewsPage />, { route: '/coach/food-reviews' });
    await userEvent.click(await screen.findByRole('button', { name: 'Revisar registro de Ana Ruiz' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }));
    expect(await screen.findByText(/aún sin revisar/)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('los ya revisados no tienen botón Revisar; los filtros viajan a la API', async () => {
    const calls = setup((c) => (c.path === '/coach/meal-logs' ? page([log({ status: 'REVIEWED', coachComment: 'Bien' })]) : undefined));
    renderWithProviders(<FoodReviewsPage />, { route: '/coach/food-reviews' });
    await screen.findByText('Avena con banano');
    expect(screen.queryByRole('button', { name: /Revisar registro/ })).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'REVIEWED');
    await waitFor(() => expect(calls.filter((c) => c.path === '/coach/meal-logs').some((c) => c.query.get('status') === 'REVIEWED')).toBe(true));
  });

  it('sin pendientes muestra el estado vacío', async () => {
    mockApi(coach, (c) => (c.path === '/coach/meal-logs' ? page([]) : page([])));
    renderWithProviders(<FoodReviewsPage />, { route: '/coach/food-reviews' });
    expect(await screen.findByText('No hay registros por revisar')).toBeInTheDocument();
  });
});
