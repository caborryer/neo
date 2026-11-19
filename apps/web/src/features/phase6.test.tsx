import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { CoachContentPage } from '@/features/content/CoachContentPage';
import { ContentFormPage } from '@/features/content/ContentFormPage';
import { UserContentPage } from '@/features/content/UserContentPage';
import { ContentDetailPage } from '@/features/content/ContentDetailPage';
import { CoachChallengesPage } from '@/features/challenges/CoachChallengesPage';
import { ChallengeFormPage } from '@/features/challenges/ChallengeFormPage';
import { CoachChallengeDetailPage } from '@/features/challenges/CoachChallengeDetailPage';
import { UserChallengesPage } from '@/features/challenges/UserChallengesPage';
import { UserChallengeDetailPage } from '@/features/challenges/UserChallengeDetailPage';
import { targetOf } from '@/features/notifications/NotificationsPage';
import { coach, json, member, renderWithProviders } from '@/test/utils';

const C_ID = '44444444-4444-4444-8444-444444444444';
const H_ID = '55555555-5555-4555-8555-555555555555';

const content = (over: object = {}) => ({
  id: C_ID, title: 'Hidratación', description: 'Cuánta agua tomar', category: 'TIPS', type: 'ARTICLE', body: 'Toma agua todo el día', videoId: null,
  thumbnailUrl: null, thumbnailAssetId: null, published: false, createdAt: '2026-11-10T12:00:00Z', updatedAt: '2026-11-10T12:00:00Z', ...over,
});
const challenge = (over: object = {}) => ({
  id: H_ID, name: 'ABS Septiembre', description: 'Doce sesiones de abdomen', category: 'ABS', goal: 12, goalUnit: 'WORKOUT_SESSIONS',
  startDate: '2026-09-01', endDate: '2026-09-30', published: true, phase: 'ACTIVE', participantCount: 2, createdAt: '2026-08-20T00:00:00Z', my: null, ...over,
});
const page = (data: unknown[]) => json({ data, meta: { page: 1, limit: 12, total: data.length, totalPages: 1 } });

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

describe('CoachContentPage (HU-33)', () => {
  it('lista el contenido con su estado, y publica sin recargar', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.method === 'GET' && c.path === '/content') return page([content()]);
      if (c.method === 'PATCH') return json({ data: content({ published: true }) });
    });
    renderWithProviders(<CoachContentPage />);
    expect(await screen.findByText('Hidratación')).toBeInTheDocument();
    expect(screen.getByText('Borrador')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publicar Hidratación' }));
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ path: `/coach/content/${C_ID}`, body: { published: true } });
  });

  it('filtra por categoría y por publicación enviando los parámetros', async () => {
    const calls = mockApi(coach, () => page([]));
    renderWithProviders(<CoachContentPage />);
    await userEvent.selectOptions(await screen.findByLabelText('Filtrar por categoría'), 'RECIPES');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por publicación'), 'false');
    const last = calls.filter((c) => c.path === '/content').at(-1)!;
    expect(last.query.get('category')).toBe('RECIPES');
    expect(last.query.get('published')).toBe('false');
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('eliminar pide confirmación y no borra si se cancela', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.method === 'GET') return page([content()]);
      if (c.method === 'DELETE') return json({ data: { id: C_ID } });
    });
    renderWithProviders(<CoachContentPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar Hidratación' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar Hidratación' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Eliminar' }));
    expect(calls.find((c) => c.method === 'DELETE')).toMatchObject({ path: `/coach/content/${C_ID}` });
  });

  it('sin contenido muestra el estado vacío con la acción de crear', async () => {
    mockApi(coach, () => page([]));
    renderWithProviders(<CoachContentPage />);
    expect(await screen.findByText('Aún no tienes contenido')).toBeInTheDocument();
  });
});

describe('ContentFormPage (HU-33)', () => {
  it('un artículo exige texto y un video exige enlace de YouTube válido', async () => {
    mockApi(coach, () => undefined);
    renderWithProviders(<ContentFormPage />);
    await userEvent.type(await screen.findByLabelText('Título'), 'Tip');
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'TIPS');
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'ARTICLE');
    await userEvent.click(screen.getByRole('button', { name: 'Crear contenido' }));
    expect(await screen.findByText('Escribe el texto del artículo')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'VIDEO');
    expect(screen.queryByLabelText('Texto del artículo')).toBeNull();
    await userEvent.type(screen.getByLabelText(/Video de YouTube/), 'https://vimeo.com/123');
    await userEvent.click(screen.getByRole('button', { name: 'Crear contenido' }));
    expect(await screen.findByText('Ingresa un enlace o ID de YouTube válido')).toBeInTheDocument();
  });

  it('crea un artículo enviando solo lo que corresponde al tipo', async () => {
    const calls = mockApi(coach, (c) => (c.method === 'POST' ? json({ data: content() }, 201) : undefined));
    renderWithProviders(<ContentFormPage />);
    await userEvent.type(await screen.findByLabelText('Título'), 'Hidratación');
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'TIPS');
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'ARTICLE');
    await userEvent.type(screen.getByLabelText('Texto del artículo'), 'Toma agua');
    await userEvent.click(screen.getByRole('button', { name: 'Crear contenido' }));
    const post = await vi.waitFor(() => {
      const p = calls.find((c) => c.method === 'POST');
      expect(p).toBeDefined();
      return p!;
    });
    expect(post.path).toBe('/coach/content');
    expect(post.body).toEqual({ title: 'Hidratación', description: null, category: 'TIPS', type: 'ARTICLE', body: 'Toma agua', video: null, thumbnailAssetId: null, published: false });
  });

  it('al editar un video precarga el enlace y muestra la vista previa', async () => {
    mockApi(coach, (c) => (c.path === `/content/${C_ID}` ? json({ data: content({ type: 'VIDEO', category: 'VIDEOS', body: null, videoId: 'dQw4w9WgXcQ' }) }) : undefined));
    renderWithProviders(<p />, { route: `/coach/content/${C_ID}/edit`, routes: <Route path="/coach/content/:id/edit" element={<ContentFormPage />} /> });
    expect(await screen.findByLabelText(/Video de YouTube/)).toHaveValue('https://youtu.be/dQw4w9WgXcQ');
    expect(screen.getByTitle('Vista previa del video')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
});

describe('Contenido para la usuaria', () => {
  it('lista lo publicado y filtra por categoría', async () => {
    const calls = mockApi(member, (c) => (c.path === '/content' ? page([content({ published: true })]) : undefined));
    renderWithProviders(<UserContentPage />);
    const link = await screen.findByRole('link', { name: /Hidratación/ });
    expect(link).toHaveAttribute('href', `/app/content/${C_ID}`);
    await userEvent.click(screen.getByRole('button', { name: 'Recetas' }));
    await vi.waitFor(() => expect(calls.filter((c) => c.path === '/content').at(-1)!.query.get('category')).toBe('RECIPES'));
  });

  it('el detalle de un artículo muestra el texto y el de un video, el reproductor sin cookies', async () => {
    mockApi(member, (c) => (c.path === `/content/${C_ID}` ? json({ data: content({ published: true }) }) : undefined));
    const routes = <Route path="/app/content/:id" element={<ContentDetailPage />} />;
    const { unmount } = renderWithProviders(<p />, { route: `/app/content/${C_ID}`, routes });
    expect(await screen.findByText('Toma agua todo el día')).toBeInTheDocument();
    unmount();
    vi.restoreAllMocks();
    mockApi(member, (c) => (c.path === `/content/${C_ID}` ? json({ data: content({ published: true, type: 'VIDEO', body: null, videoId: 'dQw4w9WgXcQ' }) }) : undefined));
    renderWithProviders(<p />, { route: `/app/content/${C_ID}`, routes });
    expect(await screen.findByTitle('Hidratación')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });

  it('un contenido que no es suyo o no está publicado muestra "no encontrado"', async () => {
    mockApi(member, (c) => (c.path === `/content/${C_ID}` ? json({ statusCode: 404, message: 'Contenido no encontrado', error: 'Not Found' }, 404) : undefined));
    renderWithProviders(<p />, { route: `/app/content/${C_ID}`, routes: <Route path="/app/content/:id" element={<ContentDetailPage />} /> });
    expect(await screen.findByText('No encontramos ese contenido.')).toBeInTheDocument();
  });
});

describe('Retos de la Coach (HU-29)', () => {
  it('lista con meta, participantes y fase; publica/despublica', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.path === '/coach/challenges' && c.method === 'GET') return page([challenge()]);
      if (c.method === 'PATCH') return json({ data: challenge({ published: false }) });
    });
    renderWithProviders(<CoachChallengesPage />);
    expect(await screen.findByText('ABS Septiembre')).toBeInTheDocument();
    expect(screen.getByText('2 participantes')).toBeInTheDocument();
    expect(screen.getByText('En curso')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Despublicar ABS Septiembre' }));
    expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ path: `/coach/challenges/${H_ID}`, body: { published: false } });
  });

  it('valida el formulario y crea el reto', async () => {
    const calls = mockApi(coach, (c) => (c.method === 'POST' ? json({ data: challenge() }, 201) : undefined));
    renderWithProviders(<ChallengeFormPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Crear reto' }));
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument();
    expect(screen.getByText('El objetivo es obligatorio')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Nombre'), 'ABS Septiembre');
    await userEvent.type(screen.getByLabelText('Categoría'), 'ABS');
    await userEvent.type(screen.getByLabelText('Meta (sesiones)'), '12');
    await userEvent.type(screen.getByLabelText('Inicio'), '2026-09-30');
    await userEvent.type(screen.getByLabelText('Fin'), '2026-09-01');
    await userEvent.click(screen.getByRole('button', { name: 'Crear reto' }));
    expect(await screen.findByText('La fecha de fin no puede ser anterior al inicio')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Inicio'));
    await userEvent.type(screen.getByLabelText('Inicio'), '2026-09-01');
    await userEvent.clear(screen.getByLabelText('Fin'));
    await userEvent.type(screen.getByLabelText('Fin'), '2026-09-30');
    await userEvent.click(screen.getByRole('button', { name: 'Crear reto' }));
    const post = await vi.waitFor(() => {
      const p = calls.find((c) => c.method === 'POST');
      expect(p).toBeDefined();
      return p!;
    });
    expect(post.body).toEqual({ name: 'ABS Septiembre', category: 'ABS', description: null, goal: 12, startDate: '2026-09-01', endDate: '2026-09-30', published: false });
  });

  it('con participantes, la meta y las fechas quedan bloqueadas y no se envían', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.path === `/coach/challenges/${H_ID}` && c.method === 'GET') {
        return json({ data: { ...challenge(), participants: [{ userId: 'u1', name: 'Ana Ruiz', status: 'IN_PROGRESS', progress: 3, joinedAt: '2026-09-02T00:00:00Z' }] } });
      }
      if (c.method === 'PATCH') return json({ data: challenge() });
    });
    renderWithProviders(<p />, { route: `/coach/challenges/${H_ID}/edit`, routes: <Route path="/coach/challenges/:id/edit" element={<ChallengeFormPage />} /> });
    expect(await screen.findByLabelText('Meta (sesiones)')).toBeDisabled();
    expect(screen.getByLabelText('Inicio')).toBeDisabled();
    expect(screen.getByText(/ya tiene participantes/)).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Nombre'));
    await userEvent.type(screen.getByLabelText('Nombre'), 'ABS Sept.');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    const patch = await vi.waitFor(() => {
      const p = calls.find((c) => c.method === 'PATCH');
      expect(p).toBeDefined();
      return p!;
    });
    expect(patch.body).toEqual({ name: 'ABS Sept.', category: 'ABS', description: 'Doce sesiones de abdomen', published: true });
  });

  it('el detalle muestra el avance de cada participante', async () => {
    mockApi(coach, (c) =>
      c.path === `/coach/challenges/${H_ID}`
        ? json({ data: { ...challenge(), participants: [
            { userId: 'u1', name: 'Ana Ruiz', status: 'IN_PROGRESS', progress: 5, joinedAt: '2026-09-02T00:00:00Z' },
            { userId: 'u2', name: 'Bea Gil', status: 'COMPLETED', progress: 14, joinedAt: '2026-09-03T00:00:00Z' },
          ] } })
        : undefined,
    );
    renderWithProviders(<p />, { route: `/coach/challenges/${H_ID}`, routes: <Route path="/coach/challenges/:id" element={<CoachChallengeDetailPage />} /> });
    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByText('5 / 12')).toBeInTheDocument();
    // El progreso por encima de la meta se muestra topado en la meta.
    expect(screen.getByText('12 / 12')).toBeInTheDocument();
    expect(screen.getByText('Completado')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progreso de Ana Ruiz' })).toHaveAttribute('aria-valuenow', '5');
  });
});

describe('Retos de la usuaria (HU-30)', () => {
  it('muestra su progreso en los retos en que participa y la invitación en los demás', async () => {
    mockApi(member, (c) =>
      c.path === '/challenges'
        ? page([
            challenge({ my: { status: 'IN_PROGRESS', progress: 4, joinedAt: '2026-09-02T00:00:00Z' } }),
            challenge({ id: 'h2', name: 'Leg Week', phase: 'UPCOMING', goal: 5 }),
          ])
        : undefined,
    );
    renderWithProviders(<UserChallengesPage />);
    expect(await screen.findByText('4 / 12')).toBeInTheDocument();
    expect(screen.getByText('En progreso')).toBeInTheDocument();
    expect(screen.getByText('Próximamente')).toBeInTheDocument();
    expect(screen.getByText(/Toca para inscribirte/)).toBeInTheDocument();
  });

  const routes = <Route path="/app/challenges/:id" element={<UserChallengeDetailPage />} />;

  it('se inscribe desde el detalle y pasa a ver su progreso', async () => {
    let joined = false;
    const calls = mockApi(member, (c) => {
      if (c.method === 'POST' && c.path === `/challenges/${H_ID}/join`) {
        joined = true;
        return json({ data: challenge({ my: { status: 'IN_PROGRESS', progress: 0, joinedAt: '2026-09-02T00:00:00Z' } }) });
      }
      if (c.path === `/challenges/${H_ID}/progress`) return json({ data: { challengeId: H_ID, goal: 12, progress: 0, status: 'IN_PROGRESS', joinedAt: '2026-09-02T00:00:00Z', activities: [] } });
      if (c.path === `/challenges/${H_ID}`) return json({ data: challenge(joined ? { my: { status: 'IN_PROGRESS', progress: 0, joinedAt: '2026-09-02T00:00:00Z' } } : {}) });
    });
    renderWithProviders(<p />, { route: `/app/challenges/${H_ID}`, routes });
    await userEvent.click(await screen.findByRole('button', { name: 'Inscribirme' }));
    expect(calls.some((c) => c.method === 'POST' && c.path === `/challenges/${H_ID}/join`)).toBe(true);
    expect(await screen.findByText('0 de 12 sesiones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abandonar reto' })).toBeInTheDocument();
  });

  it('el progreso lo trae el servidor: lista las sesiones que cuentan y felicita al completar', async () => {
    mockApi(member, (c) => {
      if (c.path === `/challenges/${H_ID}/progress`) {
        return json({ data: { challengeId: H_ID, goal: 12, progress: 12, status: 'COMPLETED', joinedAt: '2026-09-02T00:00:00Z', activities: [{ sessionId: 's1', workoutTitle: 'Abs 20 min', completedAt: '2026-09-05T15:00:00Z' }] } });
      }
      if (c.path === `/challenges/${H_ID}`) return json({ data: challenge({ my: { status: 'COMPLETED', progress: 12, joinedAt: '2026-09-02T00:00:00Z' } }) });
    });
    renderWithProviders(<p />, { route: `/app/challenges/${H_ID}`, routes });
    expect(await screen.findByText('12 de 12 sesiones')).toBeInTheDocument();
    expect(screen.getByText('Abs 20 min')).toBeInTheDocument();
    expect(screen.getByText(/Completaste el reto/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abandonar reto' })).toBeNull();
  });

  it('un reto terminado no permite inscribirse y un error del servidor se muestra', async () => {
    mockApi(member, (c) => {
      if (c.path === `/challenges/${H_ID}`) return json({ data: challenge({ phase: 'ENDED' }) });
    });
    renderWithProviders(<p />, { route: `/app/challenges/${H_ID}`, routes });
    expect(await screen.findByText('Este reto ya terminó.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inscribirme' })).toBeNull();
  });

  it('si el servidor rechaza la inscripción muestra el motivo', async () => {
    mockApi(member, (c) => {
      if (c.method === 'POST') return json({ statusCode: 409, message: 'Ya estás inscrita en este reto', error: 'Conflict' }, 409);
      if (c.path === `/challenges/${H_ID}`) return json({ data: challenge() });
    });
    renderWithProviders(<p />, { route: `/app/challenges/${H_ID}`, routes });
    await userEvent.click(await screen.findByRole('button', { name: 'Inscribirme' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ya estás inscrita en este reto');
  });
});

describe('Avisos de retos (HU-25)', () => {
  const n = (type: string, data: object | null) => ({ id: 'n', type, title: 't', message: 'm', data, readAt: null, createdAt: '' }) as any;
  it('llevan al reto de la usuaria, o a la lista si no hay referencia', () => {
    expect(targetOf(n('CHALLENGE_PUBLISHED', { challengeId: H_ID }), false)).toBe(`/app/challenges/${H_ID}`);
    expect(targetOf(n('CHALLENGE_COMPLETED', { challengeId: H_ID }), false)).toBe(`/app/challenges/${H_ID}`);
    expect(targetOf(n('CHALLENGE_PUBLISHED', null), false)).toBe('/app/challenges');
  });
});
