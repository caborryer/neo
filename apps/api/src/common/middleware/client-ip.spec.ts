import { clientIpFromHeader } from './client-ip';

const run = (header: string | undefined, headers: Record<string, string | string[]>, ip = '10.0.0.9') => {
  const req: any = { headers, ip };
  Object.defineProperty(req, 'ip', { value: ip, configurable: true, writable: true });
  const next = jest.fn();
  clientIpFromHeader(header)(req, {} as any, next);
  expect(next).toHaveBeenCalled();
  return req.ip as string;
};

describe('clientIpFromHeader (IP real detrás de Railway)', () => {
  it('sin configurar no toca req.ip, aunque llegue la cabecera', () => {
    expect(run(undefined, { 'x-real-ip': '203.0.113.7' })).toBe('10.0.0.9');
  });
  it('usa la cabecera configurada', () => {
    expect(run('X-Real-IP', { 'x-real-ip': '203.0.113.7' })).toBe('203.0.113.7');
    expect(run('x-real-ip', { 'x-real-ip': '2001:db8::1' })).toBe('2001:db8::1');
  });
  it('con x-forwarded-for toma el primer valor', () => {
    expect(run('x-forwarded-for', { 'x-forwarded-for': '203.0.113.7, 100.64.0.2' })).toBe('203.0.113.7');
  });
  it('ignora valores que no son una IP (no se puede inyectar basura en el límite ni en la BD)', () => {
    expect(run('x-real-ip', { 'x-real-ip': "1.2.3.4'; DROP TABLE" })).toBe('10.0.0.9');
    expect(run('x-real-ip', { 'x-real-ip': 'a'.repeat(100) })).toBe('10.0.0.9');
  });
  it('si falta la cabecera conserva la IP de la conexión', () => {
    expect(run('x-real-ip', {})).toBe('10.0.0.9');
  });
});
