import { describe, expect, it } from 'vitest';
import { createChallengeSchema, createContentSchema, updateChallengeSchema, updateContentSchema } from './index';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('contenido (HU-33)', () => {
  it('un artículo necesita texto', () => {
    const r = createContentSchema.safeParse({ title: 'Tip', category: 'TIPS', type: 'ARTICLE' });
    expect(r.success).toBe(false);
    expect(createContentSchema.safeParse({ title: 'Tip', category: 'TIPS', type: 'ARTICLE', body: 'Hidrátate' }).success).toBe(true);
  });
  it('un video necesita YouTube y se normaliza al ID', () => {
    expect(createContentSchema.safeParse({ title: 'V', category: 'VIDEOS', type: 'VIDEO' }).success).toBe(false);
    const r = createContentSchema.parse({ title: 'V', category: 'VIDEOS', type: 'VIDEO', video: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(r.video).toBe('dQw4w9WgXcQ');
    expect(createContentSchema.safeParse({ title: 'V', category: 'VIDEOS', type: 'VIDEO', video: 'https://vimeo.com/123456789' }).success).toBe(false);
  });
  it('los textos vacíos pasan a null y nace sin publicar', () => {
    const r = createContentSchema.parse({ title: 'A', category: 'TIPS', type: 'ARTICLE', body: 'x', description: '  ', thumbnailAssetId: '' });
    expect(r.description).toBeNull();
    expect(r.thumbnailAssetId).toBeNull();
    expect(r.published).toBe(false);
  });
  it('rechaza imagen que no es UUID y campos desconocidos al editar', () => {
    expect(createContentSchema.safeParse({ title: 'A', category: 'TIPS', type: 'ARTICLE', body: 'x', thumbnailAssetId: 'no' }).success).toBe(false);
    expect(updateContentSchema.safeParse({ ownerId: UUID }).success).toBe(false);
    expect(updateContentSchema.safeParse({ published: true }).success).toBe(true);
  });
});

describe('retos (HU-29)', () => {
  const ok = { name: 'ABS Septiembre', category: 'ABS', goal: 12, startDate: '2026-09-01', endDate: '2026-09-30' };
  it('acepta un reto válido, sin publicar por defecto', () => {
    const r = createChallengeSchema.parse(ok);
    expect(r.published).toBe(false);
  });
  it('rechaza fin anterior al inicio, objetivo fuera de rango y fechas inválidas', () => {
    expect(createChallengeSchema.safeParse({ ...ok, endDate: '2026-08-31' }).success).toBe(false);
    expect(createChallengeSchema.safeParse({ ...ok, goal: 0 }).success).toBe(false);
    expect(createChallengeSchema.safeParse({ ...ok, goal: 366 }).success).toBe(false);
    expect(createChallengeSchema.safeParse({ ...ok, startDate: '2026-02-30' }).success).toBe(false);
  });
  it('al editar no acepta campos desconocidos', () => {
    expect(updateChallengeSchema.safeParse({ createdById: UUID }).success).toBe(false);
    expect(updateChallengeSchema.safeParse({ goal: 10 }).success).toBe(true);
  });
});
