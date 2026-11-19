import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Entry {
  failures: number;
  windowStart: number;
}

/**
 * Límite de intentos fallidos POR CUENTA (OWASP A07). El límite por IP del ThrottlerGuard no frena a un
 * atacante que rota de IP contra una misma cuenta. Se cuenta también para correos inexistentes, así la
 * respuesta no revela si la cuenta existe. En memoria: suficiente para una sola instancia de la API.
 */
@Injectable()
export class LoginAttemptLimiter {
  static readonly MAX_FAILURES = 10;
  static readonly WINDOW_MS = 15 * 60_000;
  private static readonly MAX_ENTRIES = 10_000;
  private readonly entries = new Map<string, Entry>();

  /** Lanza 429 si la cuenta superó el máximo de fallos en la ventana. */
  assertAllowed(email: string, now = Date.now()): void {
    const entry = this.entries.get(email);
    if (!entry) return;
    if (now - entry.windowStart >= LoginAttemptLimiter.WINDOW_MS) {
      this.entries.delete(email);
      return;
    }
    if (entry.failures >= LoginAttemptLimiter.MAX_FAILURES) {
      const waitMin = Math.ceil((LoginAttemptLimiter.WINDOW_MS - (now - entry.windowStart)) / 60_000);
      throw new HttpException(`Demasiados intentos. Intenta de nuevo en ${waitMin} min o recupera tu contraseña.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  recordFailure(email: string, now = Date.now()): void {
    const entry = this.entries.get(email);
    if (!entry || now - entry.windowStart >= LoginAttemptLimiter.WINDOW_MS) {
      if (this.entries.size >= LoginAttemptLimiter.MAX_ENTRIES) this.evictExpired(now);
      if (this.entries.size >= LoginAttemptLimiter.MAX_ENTRIES) this.entries.delete(this.entries.keys().next().value as string);
      this.entries.set(email, { failures: 1, windowStart: now });
      return;
    }
    entry.failures += 1;
  }

  recordSuccess(email: string): void {
    this.entries.delete(email);
  }

  private evictExpired(now: number): void {
    for (const [key, e] of this.entries) if (now - e.windowStart >= LoginAttemptLimiter.WINDOW_MS) this.entries.delete(key);
  }
}
