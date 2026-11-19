import { EventEmitter } from 'node:events';
import { requestLogger } from './request-logger';

function run(url: string, status: number, method = 'GET') {
  const lines: [string, string][] = [];
  const res: any = Object.assign(new EventEmitter(), { statusCode: status, headers: {} as Record<string, string>, setHeader(k: string, v: string) { this.headers[k] = v; } });
  const next = jest.fn();
  requestLogger((l, lv) => lines.push([l, lv]))({ method, originalUrl: url } as any, res, next);
  res.emit('finish');
  return { lines, res, next };
}

describe('requestLogger (RNF-10)', () => {
  it('registra método, ruta, estado y duración, y expone el id en X-Request-Id', () => {
    const { lines, res, next } = run('/api/v1/users/me', 200);
    expect(next).toHaveBeenCalled();
    expect(lines[0]![0]).toMatch(/^GET \/api\/v1\/users\/me 200 \d+ms id=[0-9a-f-]{36}$/);
    expect(res.headers['X-Request-Id']).toBe(lines[0]![0].split('id=')[1]);
  });

  it('nunca registra el query string (puede llevar tokens)', () => {
    const { lines } = run('/api/v1/auth/reset-password?token=SECRETO123', 400, 'POST');
    expect(lines[0]![0]).not.toContain('SECRETO123');
    expect(lines[0]![0]).toContain('/api/v1/auth/reset-password 400');
  });

  it('usa el nivel según el estado: 4xx warn, 5xx error', () => {
    expect(run('/x', 200).lines[0]![1]).toBe('log');
    expect(run('/x', 404).lines[0]![1]).toBe('warn');
    expect(run('/x', 500).lines[0]![1]).toBe('error');
  });

  it('no registra el healthcheck', () => {
    expect(run('/api/v1/health', 200).lines).toHaveLength(0);
  });
});
