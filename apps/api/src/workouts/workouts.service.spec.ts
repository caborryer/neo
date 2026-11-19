import { NotFoundException } from '@nestjs/common';
import { WorkoutsService } from './workouts.service';

const row = (over: object = {}) => ({
  id: 'w1', title: 'Full Body', description: null, durationMinutes: 55, difficulty: 'INTERMEDIATE', category: 'FULL_BODY',
  videoProvider: 'YOUTUBE', videoId: 'dQw4w9WgXcQ', videoVisibility: 'UNLISTED', thumbnailAssetId: null,
  equipment: ['Mat'], tips: null, isPublished: false, createdById: 'c1', createdAt: new Date(), updatedAt: new Date(), ...over,
});

function setup() {
  const tx: any = { workout: { create: jest.fn().mockImplementation(async ({ data }: any) => row(data)), findUnique: jest.fn(), update: jest.fn().mockImplementation(async ({ data }: any) => row(data)) } };
  const prisma: any = {
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
    workout: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
  };
  const audit: any = { record: jest.fn() };
  return { service: new WorkoutsService(prisma, audit), prisma, tx, audit };
}
const coach: any = { id: 'c1', role: 'COACH' };
const member: any = { id: 'u1', role: 'USER' };

describe('WorkoutsService (HU-09)', () => {
  it('crea la clase guardando el ID de YouTube y deja auditoría', async () => {
    const { service, tx, audit } = setup();
    const dto = await service.create('c1', { title: 'Full Body', durationMinutes: 55, difficulty: 'INTERMEDIATE', category: 'FULL_BODY', video: 'dQw4w9WgXcQ', videoVisibility: 'UNLISTED', equipment: ['Mat'], tips: [], isPublished: false } as any);
    expect(tx.workout.create.mock.calls[0][0].data).toMatchObject({ videoId: 'dQw4w9WgXcQ', createdById: 'c1', isPublished: false });
    expect(dto.videoId).toBe('dQw4w9WgXcQ');
    expect(dto.tips).toEqual([]);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'WORKOUT_CREATED' }), tx);
  });

  it('editar traduce video → videoId y respeta los campos no enviados', async () => {
    const { service, tx } = setup();
    tx.workout.findUnique.mockResolvedValue({ id: 'w1' });
    await service.update('c1', 'w1', { video: 'abcdefghijk', isPublished: true } as any);
    expect(tx.workout.update.mock.calls[0][0].data).toEqual({ videoId: 'abcdefghijk', isPublished: true });
  });

  it('editar una clase inexistente → 404', async () => {
    const { service, tx } = setup();
    tx.workout.findUnique.mockResolvedValue(null);
    await expect(service.update('c1', 'x', { title: 'a' } as any)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la usuaria solo lista clases que tiene asignadas (no canceladas)', async () => {
    const { service, prisma } = setup();
    await service.list(member, { page: 1, limit: 10, sortOrder: 'desc' } as any);
    expect(prisma.workout.findMany.mock.calls[0][0].where.assignments).toEqual({ some: { userId: 'u1', status: { not: 'CANCELLED' } } });
  });

  it('la usuaria no puede forzar ver borradores con ?published', async () => {
    const { service, prisma } = setup();
    await service.list(member, { page: 1, limit: 10, sortOrder: 'desc', published: 'false' } as any);
    expect(prisma.workout.findMany.mock.calls[0][0].where.isPublished).toBeUndefined();
  });

  it('la Coach ve todas y puede filtrar por publicadas y título', async () => {
    const { service, prisma } = setup();
    await service.list(coach, { page: 1, limit: 10, sortOrder: 'desc', published: 'true', search: 'full' } as any);
    const where = prisma.workout.findMany.mock.calls[0][0].where;
    expect(where.assignments).toBeUndefined();
    expect(where).toMatchObject({ isPublished: true, title: { contains: 'full', mode: 'insensitive' } });
  });

  it('detalle de una clase ajena a la usuaria → 404 (no se revela)', async () => {
    const { service, prisma } = setup();
    prisma.workout.findFirst.mockResolvedValue(null);
    await expect(service.get(member, 'w9')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workout.findFirst.mock.calls[0][0].where.assignments).toBeDefined();
  });
});
