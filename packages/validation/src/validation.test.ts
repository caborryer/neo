import { describe, expect, it } from 'vitest';
import { updateUserSchema, createUserSchema, loginSchema, resetPasswordSchema, paginationQuerySchema, changeAccessSchema } from './index';

describe('validación compartida', () => {
  it('normaliza el correo del login', () => {
    const r = loginSchema.parse({ email: '  ANA@Neo.com ', password: 'x' });
    expect(r.email).toBe('ana@neo.com');
  });

  it('rechaza un correo inválido', () => {
    expect(loginSchema.safeParse({ email: 'no-es-correo', password: 'x' }).success).toBe(false);
  });

  it('exige que las contraseñas coincidan al restablecer', () => {
    const r = resetPasswordSchema.safeParse({ token: 't', password: '12345678', confirmPassword: '87654321' });
    expect(r.success).toBe(false);
  });

  it('aplica valores por defecto y límite máximo de paginación', () => {
    expect(paginationQuerySchema.parse({})).toMatchObject({ page: 1, limit: 10 });
    expect(paginationQuerySchema.safeParse({ limit: 1000 }).success).toBe(false);
  });

  it('limita el motivo del cambio de acceso a 250 caracteres', () => {
    expect(changeAccessSchema.safeParse({ status: 'SUSPENDED', reason: 'a'.repeat(251) }).success).toBe(false);
  });

  it('updateUserSchema rechaza meta semanal fuera de rango y zonas inválidas', () => {
    expect(updateUserSchema.safeParse({ weeklyGoal: 0 }).success).toBe(false);
    expect(updateUserSchema.safeParse({ weeklyGoal: 4 }).success).toBe(true);
    expect(updateUserSchema.safeParse({ timezone: 'Marte/Olimpo' }).success).toBe(false);
    expect(updateUserSchema.safeParse({ role: 'COACH' }).success).toBe(false);
  });

  it('createUserSchema normaliza el correo y aplica zona por defecto', () => {
    const r = createUserSchema.parse({ firstName: 'Ana', lastName: 'Ruiz', email: ' ANA@Mail.com ' });
    expect(r.email).toBe('ana@mail.com');
    expect(r.timezone).toBe('America/Bogota');
  });
});
