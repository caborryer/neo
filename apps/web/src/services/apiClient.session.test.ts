import { apiRequest, setSessionLostHandler } from './apiClient';

const ok = (body: unknown = { data: 1 }) => new Response(JSON.stringify(body), { status: 200 });
const unauthorized = () => new Response(JSON.stringify({ statusCode: 401, message: 'Sesión expirada', error: 'Unauthorized' }), { status: 401 });

afterEach(() => {
  vi.restoreAllMocks();
  setSessionLostHandler(undefined);
});

describe('apiRequest: CSRF y renovación de sesión', () => {
  it('envía X-Requested-With en todas las peticiones', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok());
    await apiRequest('/x', { method: 'POST', body: { a: 1 } });
    const init = f.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Requested-With']).toBe('neo-web');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('ante 401 renueva una vez y reintenta la petición original', async () => {
    const f = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(ok({})) // /auth/refresh
      .mockResolvedValueOnce(ok({ data: 'listo' }));
    const res = await apiRequest<{ data: string }>('/users/me');
    expect(res.data).toBe('listo');
    expect(String(f.mock.calls[1]![0])).toContain('/auth/refresh');
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('varias peticiones que fallan a la vez comparten UNA sola renovación', async () => {
    let refreshCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 10));
        return ok({});
      }
      return refreshCalls === 0 ? unauthorized() : ok({ data: 1 });
    });
    await Promise.all([apiRequest('/a'), apiRequest('/b'), apiRequest('/c')]);
    expect(refreshCalls).toBe(1);
  });

  it('si la renovación falla avisa a la sesión y propaga el 401', async () => {
    const lost = vi.fn();
    setSessionLostHandler(lost);
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(unauthorized());
    await expect(apiRequest('/users/me')).rejects.toMatchObject({ statusCode: 401 });
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('las rutas /auth/* no intentan renovar (un login incorrecto no entra en bucle)', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(unauthorized());
    await expect(apiRequest('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ statusCode: 401 });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
