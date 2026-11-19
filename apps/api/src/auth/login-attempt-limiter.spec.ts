import { HttpException } from '@nestjs/common';
import { LoginAttemptLimiter as L } from './login-attempt-limiter';

describe('LoginAttemptLimiter (fuerza bruta por cuenta)', () => {
  const t0 = 1_000_000;
  it('bloquea tras el máximo de fallos y avisa con 429', () => {
    const l = new L();
    for (let i = 0; i < L.MAX_FAILURES; i++) {
      l.assertAllowed('a@b.co', t0);
      l.recordFailure('a@b.co', t0);
    }
    expect(() => l.assertAllowed('a@b.co', t0 + 1000)).toThrow(HttpException);
    try { l.assertAllowed('a@b.co', t0 + 1000); } catch (e) { expect((e as HttpException).getStatus()).toBe(429); }
  });
  it('no afecta a otras cuentas y se libera al vencer la ventana', () => {
    const l = new L();
    for (let i = 0; i < L.MAX_FAILURES; i++) l.recordFailure('a@b.co', t0);
    expect(() => l.assertAllowed('otra@b.co', t0)).not.toThrow();
    expect(() => l.assertAllowed('a@b.co', t0 + L.WINDOW_MS)).not.toThrow();
  });
  it('un acierto reinicia el contador', () => {
    const l = new L();
    for (let i = 0; i < L.MAX_FAILURES - 1; i++) l.recordFailure('a@b.co', t0);
    l.recordSuccess('a@b.co');
    for (let i = 0; i < L.MAX_FAILURES - 1; i++) l.recordFailure('a@b.co', t0);
    expect(() => l.assertAllowed('a@b.co', t0)).not.toThrow();
  });
});
