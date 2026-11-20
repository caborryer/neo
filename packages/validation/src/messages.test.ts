import { describe, expect, it } from 'vitest';
import { listMessagesQuerySchema, sendMessageSchema } from './index';

describe('sendMessageSchema (HU-32)', () => {
  it('recorta espacios y acepta texto', () => {
    expect(sendMessageSchema.parse({ body: '  Hola  ' }).body).toBe('Hola');
  });
  it('rechaza vacío o solo espacios', () => {
    expect(sendMessageSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({}).success).toBe(false);
  });
  it('limita a 2000 caracteres', () => {
    expect(sendMessageSchema.safeParse({ body: 'a'.repeat(2000) }).success).toBe(true);
    expect(sendMessageSchema.safeParse({ body: 'a'.repeat(2001) }).success).toBe(false);
  });
});

describe('listMessagesQuerySchema (HU-32)', () => {
  it('usa 30 por defecto y limita a 50', () => {
    expect(listMessagesQuerySchema.parse({}).limit).toBe(30);
    expect(listMessagesQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
  });
  it('el cursor debe ser un uuid', () => {
    expect(listMessagesQuerySchema.safeParse({ before: 'abc' }).success).toBe(false);
    expect(listMessagesQuerySchema.safeParse({ before: '11111111-1111-4111-8111-111111111111' }).success).toBe(true);
  });
});
