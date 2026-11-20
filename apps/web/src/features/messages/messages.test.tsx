import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import { CoachMessagesPage } from './CoachMessagesPage';
import { UserMessagesPage } from './UserMessagesPage';
import { MessagesLink } from './MessagesLink';
import { targetOf } from '@/features/notifications/NotificationsPage';
import { coach, json, member, renderWithProviders } from '@/test/utils';

const UID = '11111111-1111-4111-8111-111111111111';
const msg = (over: object = {}) => ({ id: 'm1', body: 'Hola Coach', mine: true, createdAt: '2026-11-19T10:00:00Z', readAt: null, ...over });

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
    if (c.path === '/messages/unread-count') return json({ data: { count: 0 } });
    const r = handler(c);
    if (!r) throw new Error(`Sin mock para ${c.method} ${c.path}`);
    return r;
  });
  return calls;
}
afterEach(() => vi.restoreAllMocks());

describe('mensajes de la usuaria (HU-32)', () => {
  const base = (c: Call, messages: unknown[] = [msg(), msg({ id: 'm2', body: 'Hola Ana', mine: false, readAt: null })]) => {
    if (c.path === '/messages/thread') return json({ data: { partnerName: 'Cata Coach' } });
    if (c.method === 'GET' && c.path === '/messages') return json({ data: messages, meta: { hasMore: false } });
    if (c.path === '/messages/read') return json({ data: { updated: 1 } });
  };

  it('muestra el hilo, el nombre de la Coach y marca como leído lo recibido', async () => {
    const calls = mockApi(member, (c) => base(c));
    renderWithProviders(<UserMessagesPage />, { route: '/app/messages' });
    expect(await screen.findByText('Hola Ana')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cata Coach' })).toBeInTheDocument();
    expect(screen.getByText('Hola Coach')).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/messages/read')).toBe(true));
  });

  it('no pide marcar leído si no hay nada nuevo', async () => {
    const calls = mockApi(member, (c) => base(c, [msg({ readAt: '2026-11-19T10:05:00Z' })]));
    renderWithProviders(<UserMessagesPage />, { route: '/app/messages' });
    expect(await screen.findByText(/· Leído/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/messages/read')).toBe(false);
  });

  it('envía un mensaje recortado y limpia el cuadro; el botón está deshabilitado si está vacío', async () => {
    const calls = mockApi(member, (c) => {
      if (c.method === 'POST' && c.path === '/messages') return json({ data: msg({ id: 'm3', body: 'Necesito ayuda' }) }, 201);
      return base(c, []);
    });
    renderWithProviders(<UserMessagesPage />, { route: '/app/messages' });
    expect(await screen.findByText('Aún no hay mensajes')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: 'Enviar mensaje' });
    expect(send).toBeDisabled();
    const box = screen.getByLabelText('Escribe un mensaje');
    await userEvent.type(box, '   ');
    expect(send).toBeDisabled();
    await userEvent.type(box, 'Necesito ayuda{Enter}');
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/messages')).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && c.path === '/messages')!.body).toEqual({ body: 'Necesito ayuda' });
    await waitFor(() => expect(box).toHaveValue(''));
  });

  it('Shift+Enter no envía', async () => {
    const calls = mockApi(member, (c) => base(c, []));
    renderWithProviders(<UserMessagesPage />, { route: '/app/messages' });
    const box = await screen.findByLabelText('Escribe un mensaje');
    await userEvent.type(box, 'a{Shift>}{Enter}{/Shift}b');
    expect(box).toHaveValue('a\nb');
    expect(calls.some((c) => c.method === 'POST' && c.path === '/messages')).toBe(false);
  });

  it('muestra el contenido como texto, nunca como HTML', async () => {
    mockApi(member, (c) => base(c, [msg({ body: '<img src=x onerror=alert(1)> <b>hola</b>', mine: false, readAt: '2026-11-19T10:00:00Z' })]));
    const { container } = renderWithProviders(<UserMessagesPage />, { route: '/app/messages' });
    expect(await screen.findByText('<img src=x onerror=alert(1)> <b>hola</b>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
  });

  it('carga mensajes anteriores con el cursor del más antiguo', async () => {
    const calls = mockApi(member, (c) => {
      if (c.path === '/messages/thread') return json({ data: { partnerName: 'Cata Coach' } });
      if (c.method === 'GET' && c.path === '/messages') {
        return c.query.get('before')
          ? json({ data: [msg({ id: 'old', body: 'Mensaje viejo', readAt: '2026-11-01T00:00:00Z' })], meta: { hasMore: false } })
          : json({ data: [msg({ id: 'm9', body: 'Reciente', readAt: '2026-11-19T00:00:00Z' })], meta: { hasMore: true } });
      }
    });
    renderWithProviders(<UserMessagesPage />, { route: '/app/messages' });
    await userEvent.click(await screen.findByRole('button', { name: 'Ver mensajes anteriores' }));
    expect(await screen.findByText('Mensaje viejo')).toBeInTheDocument();
    expect(calls.some((c) => c.query.get('before') === 'm9')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Ver mensajes anteriores' })).toBeNull();
  });

  it('error de carga con reintento', async () => {
    mockApi(member, (c) => (c.path === '/messages/thread' ? json({ data: { partnerName: 'C' } }) : json({ statusCode: 500, message: 'x', error: 'e' }, 500)));
    renderWithProviders(<UserMessagesPage />, { route: '/app/messages' });
    expect(await screen.findByText('No pudimos cargar los mensajes.')).toBeInTheDocument();
  });
});

describe('mensajes de la Coach (HU-32 · C09)', () => {
  const conv = (over: object = {}) => ({ userId: UID, userName: 'Ana Ruiz', lastMessage: { body: 'Gracias!', createdAt: '2026-11-19T10:00:00Z', mine: false }, unread: 2, ...over });
  const handler = (c: Call) => {
    if (c.path === '/coach/conversations') return json({ data: [conv(), conv({ userId: 'u2', userName: 'Bea Gómez', lastMessage: null, unread: 0 })] });
    if (c.path === `/coach/conversations/${UID}/thread`) return json({ data: { partnerName: 'Ana Ruiz' } });
    if (c.method === 'GET' && c.path === `/coach/conversations/${UID}/messages`) return json({ data: [msg({ mine: false, body: 'Gracias!' })], meta: { hasMore: false } });
    if (c.path === `/coach/conversations/${UID}/read`) return json({ data: { updated: 1 } });
    if (c.method === 'POST' && c.path === `/coach/conversations/${UID}/messages`) return json({ data: msg({ id: 'm5', body: 'De nada' }) }, 201);
  };

  it('lista conversaciones con no leídos y "Sin mensajes", y enlaza a cada hilo', async () => {
    mockApi(coach, handler);
    renderWithProviders(<CoachMessagesPage />, { route: '/coach/messages' });
    const list = await screen.findByRole('list', { name: 'Conversaciones' });
    expect(within(list).getByLabelText('2 sin leer')).toBeInTheDocument();
    expect(within(list).getByText('Sin mensajes')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: /Ana Ruiz/ })).toHaveAttribute('href', `/coach/messages/${UID}`);
    expect(screen.getByText('Elige una conversación')).toBeInTheDocument();
  });

  it('buscar vuelve a pedir la lista con el texto', async () => {
    const calls = mockApi(coach, handler);
    renderWithProviders(<CoachMessagesPage />, { route: '/coach/messages' });
    await screen.findByRole('list', { name: 'Conversaciones' });
    await userEvent.type(screen.getByLabelText('Buscar usuaria'), 'ana');
    await waitFor(() => expect(calls.some((c) => c.path === '/coach/conversations' && c.query.get('search') === 'ana')).toBe(true));
  });
});

describe('mensajes de la Coach · hilo abierto', () => {
  it('muestra el hilo de la usuaria, marca leído y envía', async () => {
    const calls = mockApi(coach, (c) => {
      if (c.path === '/coach/conversations') return json({ data: [{ userId: UID, userName: 'Ana Ruiz', lastMessage: null, unread: 0 }] });
      if (c.path === `/coach/conversations/${UID}/thread`) return json({ data: { partnerName: 'Ana Ruiz' } });
      if (c.method === 'GET' && c.path === `/coach/conversations/${UID}/messages`) return json({ data: [msg({ mine: false, body: 'Gracias!' })], meta: { hasMore: false } });
      if (c.path === `/coach/conversations/${UID}/read`) return json({ data: { updated: 1 } });
      if (c.method === 'POST' && c.path === `/coach/conversations/${UID}/messages`) return json({ data: msg({ id: 'm5', body: 'De nada' }) }, 201);
    });
    renderWithProviders(null as never, { route: `/coach/messages/${UID}`, routes: <Route path="/coach/messages/:userId" element={<CoachMessagesPage />} /> });
    expect(await screen.findByText('Gracias!', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ana Ruiz' })).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.path === `/coach/conversations/${UID}/read`)).toBe(true));
    await userEvent.type(screen.getByLabelText('Escribe un mensaje'), 'De nada{Enter}');
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path.endsWith('/messages'))?.body).toEqual({ body: 'De nada' }));
  });
});

describe('enlace de mensajes y notificación', () => {
  it('el icono muestra los no leídos en su nombre accesible', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname.replace('/api/v1', '');
      if (path === '/users/me') return json({ data: member });
      if (path === '/messages/unread-count') return json({ data: { count: 3 } });
      throw new Error(path);
    });
    renderWithProviders(<MessagesLink to="/app/messages" />);
    expect(await screen.findByRole('link', { name: 'Mensajes, 3 sin leer' })).toHaveAttribute('href', '/app/messages');
  });

  it('la notificación de mensaje lleva al hilo correcto según el rol', () => {
    const n: any = { id: 'n', type: 'NEW_MESSAGE', title: '', message: '', data: { threadUserId: UID }, readAt: null, createdAt: '' };
    expect(targetOf(n, true)).toBe(`/coach/messages/${UID}`);
    expect(targetOf(n, false)).toBe('/app/messages');
    expect(targetOf({ ...n, data: null }, true)).toBe('/coach/messages');
  });
});
