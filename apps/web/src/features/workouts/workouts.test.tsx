import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { WorkoutFormPage } from './WorkoutFormPage';
import { WorkoutsListPage } from './WorkoutsListPage';
import { WorkoutDetailPage } from './WorkoutDetailPage';
import { FeedbackPage } from './FeedbackPage';
import { UserCalendarPage } from '@/features/calendar/UserCalendarPage';
import { CoachCalendarPage } from '@/features/calendar/CoachCalendarPage';
import { coach, json, member, renderWithProviders } from '@/test/utils';
import { toDateKey } from '@/utils/calendar';

const A_ID = '33333333-3333-4333-8333-333333333333';
const today = toDateKey(new Date());
const tomorrow = toDateKey(new Date(Date.now() + 86_400_000));

const workout = (over: object = {}) => ({
  id: 'w1', title: 'Full Body', description: 'Rutina completa', durationMinutes: 55, difficulty: 'INTERMEDIATE', category: 'FULL_BODY', videoId: 'dQw4w9WgXcQ',
  videoVisibility: 'UNLISTED', equipment: ['Mat'], tips: ['Respira'], isPublished: true, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...over,
});
const assignment = (over: object = {}) => ({
  id: A_ID, scheduledDate: today, scheduledTime: null, status: 'SCHEDULED', user: { id: 'u1', firstName: 'Ana', lastName: 'Ruiz' },
  workout: workout(), session: null, ...over,
});
const page = (data: unknown[]) => json({ data, meta: { page: 1, limit: 10, total: data.length, totalPages: 1 } });

interface Call { method: string; path: string; query: URLSearchParams; body: any }
function mockApi(me: unknown, handler: (c: Call) => Response | undefined) {
  const calls: Call[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const c: Call = { method: (init as RequestInit | undefined)?.method ?? 'GET', path: url.pathname.replace('/api/v1', ''), query: url.searchParams, body: init?.body ? JSON.parse(init.body as string) : undefined };
    calls.push(c);
    if (c.path === '/users/me') return json({ data: me });
    const r = handler(c);
    if (!r) throw new Error(`Sin mock para ${c.method} ${c.path}`);
    return r;
  });
  return calls;
}
afterEach(() => vi.restoreAllMocks());

describe('WorkoutFormPage (HU-09)', () => {
  const fill = async () => {
    await userEvent.type(await screen.findByLabelText('Título'), 'Full Body');
    await userEvent.type(screen.getByLabelText('Duración (minutos)'), '55');
    await userEvent.selectOptions(screen.getByLabelText('Nivel'), 'INTERMEDIATE');
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'FULL_BODY');
  };

  it('valida campos obligatorios y un enlace de YouTube inválido', async () => {
    mockApi(coach, () => undefined);
    renderWithProviders(<WorkoutFormPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Crear clase' }));
    expect(await screen.findByText('El título es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El video es obligatorio')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Video de YouTube/), 'https://vimeo.com/123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear clase' }));
    expect(await screen.findByText('Ingresa un enlace o ID de YouTube válido')).toBeInTheDocument();
  });

  it('muestra la vista previa del video al pegar un enlace válido', async () => {
    mockApi(coach, () => undefined);
    renderWithProviders(<WorkoutFormPage />);
    await userEvent.type(await screen.findByLabelText(/Video de YouTube/), 'https://youtu.be/dQw4w9WgXcQ');
    const frame = await screen.findByTitle('Vista previa del video');
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('crea la clase enviando materiales y tips como listas', async () => {
    const calls = mockApi(coach, (c) => (c.method === 'POST' && c.path === '/coach/workouts' ? json({ data: workout() }, 201) : c.path === '/workouts' ? page([]) : undefined));
    renderWithProviders(<WorkoutFormPage />);
    await fill();
    await userEvent.type(screen.getByLabelText(/Video de YouTube/), 'https://youtu.be/dQw4w9WgXcQ');
    await userEvent.type(screen.getByLabelText(/Materiales/), 'Mat{Enter}Botella');
    await userEvent.type(screen.getByLabelText(/Tips/), 'Respira');
    await userEvent.click(screen.getByLabelText(/Publicada/));
    await userEvent.click(screen.getByRole('button', { name: 'Crear clase' }));
    await vi.waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({
      title: 'Full Body', durationMinutes: 55, difficulty: 'INTERMEDIATE', category: 'FULL_BODY', video: 'https://youtu.be/dQw4w9WgXcQ',
      equipment: ['Mat', 'Botella'], tips: ['Respira'], isPublished: true,
    });
  });

  it('editar carga los datos de la clase', async () => {
    mockApi(coach, (c) => (c.path === '/workouts/w1' ? json({ data: workout({ title: 'HIIT 30' }) }) : undefined));
    renderWithProviders(<p />, { route: '/coach/workouts/w1/edit', routes: <Route path="/coach/workouts/:id/edit" element={<WorkoutFormPage />} /> });
    expect(await screen.findByDisplayValue('HIIT 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });
});

describe('WorkoutsListPage', () => {
  it('lista clases con estado y permite publicar un borrador', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.path === '/workouts') return page([workout({ isPublished: false })]);
      if (c.method === 'PATCH') return json({ data: workout() });
      return undefined;
    });
    renderWithProviders(<WorkoutsListPage />);
    expect(await screen.findByText('Borrador')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publicar Full Body' }));
    await vi.waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ isPublished: true });
  });

  it('sin clases muestra el estado vacío con acción', async () => {
    mockApi(coach, (c) => (c.path === '/workouts' ? page([]) : undefined));
    renderWithProviders(<WorkoutsListPage />);
    expect(await screen.findByText('Aún no tienes clases')).toBeInTheDocument();
  });
});

describe('CoachCalendarPage (HU-10)', () => {
  const users = page([{ id: 'u1', firstName: 'Ana', lastName: 'Ruiz', status: 'ACTIVE' }, { id: 'u2', firstName: 'Bea', lastName: 'Paz', status: 'ACTIVE' }]);
  const base = (c: Call, items: unknown[] = [assignment()]) => {
    if (c.path === '/workout-assignments') return json({ data: items });
    if (c.path === '/coach/users') return users.clone();
    if (c.path === '/workouts') return page([workout()]);
    return undefined;
  };

  it('muestra las asignaciones del día con su estado y acciones', async () => {
    mockApi(coach, (c) => base(c));
    renderWithProviders(<CoachCalendarPage />);
    expect(await screen.findByText('Full Body')).toBeInTheDocument();
    expect(screen.getByText('Programada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reprogramar Full Body de Ana/ })).toBeInTheDocument();
  });

  it('asigna una clase a varias usuarias y muestra a quién no se pudo', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.method === 'POST' && c.path === '/coach/workout-assignments') return json({ data: { created: [assignment()], skipped: [{ userId: 'u2', reason: 'Ya tiene esta clase en esa fecha' }] } }, 201);
      return base(c, []);
    });
    renderWithProviders(<CoachCalendarPage />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Asignar clase' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    await vi.waitFor(() => expect(within(dialog).getByRole('option', { name: /Full Body/ })).toBeInTheDocument());
    await userEvent.selectOptions(within(dialog).getByLabelText('Clase'), 'w1');
    await userEvent.click(await within(dialog).findByLabelText('Ana Ruiz'));
    await userEvent.click(within(dialog).getByLabelText('Bea Paz'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Asignar' }));
    expect(await within(dialog).findByText(/Bea Paz: Ya tiene esta clase/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ workoutId: 'w1', userIds: ['u1', 'u2'], scheduledDate: today, scheduledTime: null });
  });

  it('el botón Asignar está deshabilitado sin clase o sin usuarias', async () => {
    mockApi(coach, (c) => base(c, []));
    renderWithProviders(<CoachCalendarPage />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Asignar clase' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Asignar' })).toBeDisabled();
  });

  it('cancelar pide confirmación y envía status CANCELLED', async () => {
    const calls = mockApi(coach, (c) => (c.method === 'PATCH' ? json({ data: assignment({ status: 'CANCELLED' }) }) : base(c)));
    renderWithProviders(<CoachCalendarPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Cancelar Full Body de Ana/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar entrenamiento' }));
    await vi.waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ status: 'CANCELLED' });
  });

  it('reprogramar envía nueva fecha y hora; un 409 se muestra en el diálogo', async () => {
    const calls = mockApi(coach, (c) => (c.method === 'PATCH' ? json({ statusCode: 409, message: 'Ya tiene esta clase en esa fecha', error: 'Conflict' }, 409) : base(c)));
    renderWithProviders(<CoachCalendarPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Reprogramar Full Body de Ana/ }));
    const dialog = await screen.findByRole('dialog');
    const date = within(dialog).getByLabelText('Nueva fecha');
    await userEvent.clear(date);
    await userEvent.type(date, tomorrow);
    await userEvent.type(within(dialog).getByLabelText(/Hora/), '07:30');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ya tiene esta clase en esa fecha');
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ scheduledDate: tomorrow, scheduledTime: '07:30' });
  });

  it('las canceladas se ven en el día pero sin acciones', async () => {
    mockApi(coach, (c) => base(c, [assignment({ status: 'CANCELLED' })]));
    renderWithProviders(<CoachCalendarPage />);
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reprogramar/ })).not.toBeInTheDocument();
  });
});

describe('UserCalendarPage (HU-17)', () => {
  it('lista los entrenamientos del día seleccionado', async () => {
    mockApi(member, (c) => (c.path === '/workout-assignments' ? json({ data: [assignment(), assignment({ id: 'x', scheduledDate: tomorrow, workout: workout({ title: 'Mañana' }) })] }) : undefined));
    renderWithProviders(<UserCalendarPage />);
    expect(await screen.findByText('Full Body')).toBeInTheDocument();
    expect(screen.queryByText('Mañana')).not.toBeInTheDocument();
  });

  it('día sin entrenamientos muestra estado vacío', async () => {
    mockApi(member, (c) => (c.path === '/workout-assignments' ? json({ data: [] }) : undefined));
    renderWithProviders(<UserCalendarPage />);
    expect(await screen.findByText('Sin entrenamientos este día')).toBeInTheDocument();
  });

  it('cambiar de mes vuelve a consultar el rango nuevo', async () => {
    const calls = mockApi(member, (c) => (c.path === '/workout-assignments' ? json({ data: [] }) : undefined));
    renderWithProviders(<UserCalendarPage />);
    await screen.findByText('Sin entrenamientos este día');
    await userEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
    await vi.waitFor(() => expect(calls.filter((c) => c.path === '/workout-assignments').length).toBe(2));
  });
});

describe('WorkoutDetailPage (HU-18/19)', () => {
  const routes = <Route path="/app/workouts/:id" element={<WorkoutDetailPage />} />;
  const detail = (over: object = {}) => json({ data: assignment(over) });

  it('muestra el reproductor sin cookies y las pestañas con su contenido', async () => {
    mockApi(member, (c) => (c.path === `/workout-assignments/${A_ID}` ? detail() : undefined));
    renderWithProviders(<p />, { route: `/app/workouts/${A_ID}`, routes });
    expect(await screen.findByTitle('Full Body')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(screen.getByText('Rutina completa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Tips' }));
    expect(screen.getByText('Respira')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Materiales' }));
    expect(screen.getByText('Mat')).toBeInTheDocument();
  });

  it('marcar como completada registra la sesión con idempotencyKey y lleva al formulario', async () => {
    const calls = mockApi(member, (c) => {
      if (c.path === `/workout-assignments/${A_ID}`) return detail();
      if (c.method === 'POST' && c.path === '/workout-sessions') return json({ data: { id: 's1' } }, 201);
      return undefined;
    });
    renderWithProviders(<p />, { route: `/app/workouts/${A_ID}`, routes: <>{routes}<Route path="/app/workouts/:id/feedback" element={<p>Formulario</p>} /></> });
    await userEvent.click(await screen.findByRole('button', { name: /Marcar como completada/ }));
    expect(await screen.findByText('Formulario')).toBeInTheDocument();
    const body = calls.find((c) => c.method === 'POST')!.body;
    expect(body.assignmentId).toBe(A_ID);
    expect(body.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('un fallo de red y reintento reutiliza la MISMA clave (no duplica)', async () => {
    let attempt = 0;
    const calls = mockApi(member, (c) => {
      if (c.path === `/workout-assignments/${A_ID}`) return detail();
      if (c.path === '/workout-sessions') return ++attempt === 1 ? json({ statusCode: 500, message: 'x', error: 'x' }, 500) : json({ data: { id: 's1' } }, 200);
      return undefined;
    });
    renderWithProviders(<p />, { route: `/app/workouts/${A_ID}`, routes: <>{routes}<Route path="/app/workouts/:id/feedback" element={<p>Formulario</p>} /></> });
    const btn = await screen.findByRole('button', { name: /Marcar como completada/ });
    await userEvent.click(btn);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Marcar como completada/ }));
    await screen.findByText('Formulario');
    const keys = calls.filter((c) => c.path === '/workout-sessions').map((c) => c.body.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('una fecha futura deshabilita el botón y lo explica', async () => {
    mockApi(member, (c) => (c.path === `/workout-assignments/${A_ID}` ? detail({ scheduledDate: tomorrow }) : undefined));
    renderWithProviders(<p />, { route: `/app/workouts/${A_ID}`, routes });
    expect(await screen.findByRole('button', { name: /Marcar como completada/ })).toBeDisabled();
    expect(screen.getByText(/Podrás registrarlo el/)).toBeInTheDocument();
  });

  it('completada sin feedback ofrece ir al formulario; con feedback lo confirma', async () => {
    const session = { id: 's1', assignmentId: A_ID, status: 'COMPLETED', hasFeedback: false };
    mockApi(member, (c) => (c.path === `/workout-assignments/${A_ID}` ? detail({ status: 'COMPLETED', session }) : undefined));
    const { unmount } = renderWithProviders(<p />, { route: `/app/workouts/${A_ID}`, routes });
    expect(await screen.findByRole('button', { name: /Contarle a tu Coach/ })).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();
    mockApi(member, (c) => (c.path === `/workout-assignments/${A_ID}` ? detail({ status: 'COMPLETED', session: { ...session, hasFeedback: true } }) : undefined));
    renderWithProviders(<p />, { route: `/app/workouts/${A_ID}`, routes });
    expect(await screen.findByText(/Ya registraste este entrenamiento/)).toBeInTheDocument();
  });

  it('un entrenamiento ajeno (404) muestra mensaje', async () => {
    mockApi(member, (c) => (c.path === `/workout-assignments/${A_ID}` ? json({ statusCode: 404, message: 'x', error: 'x' }, 404) : undefined));
    renderWithProviders(<p />, { route: `/app/workouts/${A_ID}`, routes });
    expect(await screen.findByText('No encontramos este entrenamiento.')).toBeInTheDocument();
  });
});

describe('FeedbackPage (HU-20)', () => {
  const routes = <><Route path="/app/workouts/:id/feedback" element={<FeedbackPage />} /><Route path="/app/workouts/:id" element={<p>Detalle</p>} /></>;
  const withSession = () => assignment({ status: 'COMPLETED', session: { id: 's1', assignmentId: A_ID, status: 'COMPLETED', hasFeedback: false } });
  const setup = (extra?: (c: Call) => Response | undefined) =>
    mockApi(member, (c) => (c.path === `/workout-assignments/${A_ID}` ? json({ data: withSession() }) : extra?.(c)));
  const open = () => renderWithProviders(<p />, { route: `/app/workouts/${A_ID}/feedback`, routes });

  it('sin sesión registrada redirige al detalle', async () => {
    mockApi(member, (c) => (c.path === `/workout-assignments/${A_ID}` ? json({ data: assignment() }) : undefined));
    open();
    expect(await screen.findByText('Detalle')).toBeInTheDocument();
  });

  it('exige completada y calificación; el resto de campos solo aparece según la respuesta', async () => {
    setup();
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Indica si completaste la sesión')).toBeInTheDocument();
    expect(screen.getByText('Califica cómo te sentiste')).toBeInTheDocument();
    expect(screen.queryByLabelText(/porcentaje/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Parcial'));
    expect(screen.getByLabelText(/porcentaje/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('No', { selector: 'input[name="completed"]' }));
    expect(screen.getByLabelText(/Por qué no la completaste/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/porcentaje/)).not.toBeInTheDocument();
  });

  it('Parcial exige porcentaje; comió antes exige qué comió', async () => {
    setup();
    open();
    await userEvent.click(await screen.findByLabelText('Parcial'));
    await userEvent.click(screen.getByLabelText('4 de 5'));
    await userEvent.click(screen.getByLabelText('Sí', { selector: 'input[name="ateBeforeWorkout"]' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Indica el porcentaje completado')).toBeInTheDocument();
    expect(screen.getByText('Cuéntanos qué comiste')).toBeInTheDocument();
  });

  it('envía el feedback y muestra el agradecimiento', async () => {
    const calls = setup((c) => (c.method === 'POST' && c.path === '/workout-sessions/s1/feedback' ? json({ data: { id: 'f1' } }, 201) : undefined));
    open();
    await userEvent.click(await screen.findByLabelText('Parcial'));
    await userEvent.type(screen.getByLabelText(/porcentaje/), '60');
    await userEvent.click(screen.getByLabelText('4 de 5'));
    await userEvent.type(screen.getByLabelText(/Cuéntanos más/), 'Muy bien');
    await userEvent.click(screen.getByLabelText('Sí', { selector: 'input[name="ateBeforeWorkout"]' }));
    await userEvent.type(screen.getByLabelText('¿Qué comiste?'), 'Avena');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('¡Gracias!')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({
      completed: 'PARTIAL', completionPercentage: 60, notCompletedReason: null, feelingRating: 4, feelingDescription: 'Muy bien', ateBeforeWorkout: true, preWorkoutMeal: 'Avena',
    });
  });

  it('un 409 (ya enviada) se trata como éxito para no duplicar', async () => {
    setup((c) => (c.method === 'POST' ? json({ statusCode: 409, message: 'Ya enviaste', error: 'Conflict' }, 409) : undefined));
    open();
    await userEvent.click(await screen.findByLabelText('Sí', { selector: 'input[name="completed"]' }));
    await userEvent.click(screen.getByLabelText('5 de 5'));
    await userEvent.click(screen.getByLabelText('No', { selector: 'input[name="ateBeforeWorkout"]' }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('¡Gracias!')).toBeInTheDocument();
  });

  it('si ya había feedback muestra directamente el agradecimiento', async () => {
    mockApi(member, (c) => (c.path === `/workout-assignments/${A_ID}` ? json({ data: assignment({ status: 'COMPLETED', session: { id: 's1', assignmentId: A_ID, status: 'COMPLETED', hasFeedback: true } }) }) : undefined));
    open();
    expect(await screen.findByText('¡Gracias!')).toBeInTheDocument();
  });
});
