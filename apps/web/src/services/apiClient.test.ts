import { ApiError, apiRequest } from './apiClient';

afterEach(() => vi.restoreAllMocks());

describe('apiRequest', () => {
  it('envía cookies y devuelve el JSON', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } }), { status: 200 }));
    const result = await apiRequest<{ data: { ok: boolean } }>('/health', { query: { a: 1, b: undefined } });
    expect(result.data.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/api/v1/health?a=1');
    expect((init as RequestInit).credentials).toBe('include');
  });

  it('convierte errores del contrato en ApiError con details', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 400, message: 'Validation failed', error: 'Bad Request', details: [{ field: 'email', message: 'Invalid email' }] }), { status: 400 }),
    );
    await expect(apiRequest('/x')).rejects.toMatchObject({ statusCode: 400, details: [{ field: 'email' }] });
    await expect(apiRequest('/x')).rejects.toBeInstanceOf(ApiError);
  });
});
