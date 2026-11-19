import { MyPlanService } from './my-plan.service';

const user: any = { id: 'u1', role: 'USER', timezone: 'America/Bogota' };

describe('MyPlanService (HU-21)', () => {
  function setup() {
    const prisma: any = { nutritionPlanAssignment: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) } };
    return { service: new MyPlanService(prisma), prisma };
  }

  it('solo consulta asignaciones activas de la propia usuaria, vigentes en la fecha pedida', async () => {
    const { service, prisma } = setup();
    prisma.nutritionPlanAssignment.findFirst.mockResolvedValue(null);
    const r = await service.current(user, '2026-11-18');
    expect(r).toEqual({ current: null, upcoming: null });
    const where = prisma.nutritionPlanAssignment.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: 'u1', status: 'ACTIVE', startDate: { lte: new Date('2026-11-18T00:00:00Z') } });
    expect(where.OR).toEqual([{ endDate: null }, { endDate: { gte: new Date('2026-11-18T00:00:00Z') } }]);
  });

  it('devuelve el plan con sus días y avisa del próximo plan', async () => {
    const { service, prisma } = setup();
    prisma.nutritionPlanAssignment.findFirst
      .mockResolvedValueOnce({
        id: 'a1', startDate: new Date('2026-11-01'), endDate: null,
        version: { versionNumber: 2, notes: 'Hidratarse', plan: { name: 'Plan base', description: null }, days: [{ id: 'd1', dayNumber: 1, dayName: 'MONDAY', meals: [] }] },
      })
      .mockResolvedValueOnce({ startDate: new Date('2026-12-01'), version: { plan: { name: 'Plan nuevo' } } });
    const r = await service.current(user);
    expect(r.current).toMatchObject({ assignmentId: 'a1', planName: 'Plan base', versionNumber: 2, notes: 'Hidratarse', startDate: '2026-11-01' });
    expect(r.current!.days[0]!.dayName).toBe('MONDAY');
    expect(r.upcoming).toEqual({ planName: 'Plan nuevo', startDate: '2026-12-01' });
  });

  it('el historial es solo de la usuaria autenticada', async () => {
    const { service, prisma } = setup();
    await service.history(user);
    expect(prisma.nutritionPlanAssignment.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
  });
});
