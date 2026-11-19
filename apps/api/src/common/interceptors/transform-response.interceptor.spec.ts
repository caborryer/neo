import { lastValueFrom, of } from 'rxjs';
import { TransformResponseInterceptor } from './transform-response.interceptor';

const run = (value: unknown) =>
  lastValueFrom(new TransformResponseInterceptor().intercept({} as never, { handle: () => of(value) }));

describe('TransformResponseInterceptor', () => {
  it('envuelve en data', async () => {
    expect(await run({ id: '1' })).toEqual({ data: { id: '1' } });
  });

  it('respeta listados con meta', async () => {
    const list = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    expect(await run(list)).toBe(list);
  });

  it('devuelve data null si no hay contenido', async () => {
    expect(await run(undefined)).toEqual({ data: null });
  });
});
