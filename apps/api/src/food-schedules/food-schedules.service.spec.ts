import { FoodSchedulesService } from './food-schedules.service';

function setup(rows: any[] = []) {
  const prisma: any = {
    foodSchedule: { findMany: jest.fn().mockResolvedValue(rows), upsert: jest.fn().mockImplementation(async ({ create }: any) => create) },
  };
  return { service: new FoodSchedulesService(prisma), prisma };
}

describe('FoodSchedulesService (HU-23)', () => {
  it('sin configuración devuelve las 5 horas sugeridas, marcadas como por defecto y sin recordatorio', async () => {
    const { service } = setup();
    const list = await service.list('u1');
    expect(list.map((s) => s.mealType)).toEqual(['BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'DINNER']);
    expect(list.every((s) => s.isDefault && !s.reminderEnabled)).toBe(true);
  });

  it('mezcla lo guardado con los valores por defecto', async () => {
    const { service, prisma } = setup([{ mealType: 'LUNCH', scheduledTime: '12:15', reminderEnabled: true }]);
    const list = await service.list('u1');
    expect(prisma.foodSchedule.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
    expect(list.find((s) => s.mealType === 'LUNCH')).toEqual({ mealType: 'LUNCH', scheduledTime: '12:15', reminderEnabled: true, isDefault: false });
    expect(list.find((s) => s.mealType === 'DINNER')?.isDefault).toBe(true);
  });

  it('upsert guarda por (usuaria, tipo de comida) y no por id enviado', async () => {
    const { service, prisma } = setup();
    const res = await service.upsert('u1', 'DINNER' as any, { scheduledTime: '20:00', reminderEnabled: true });
    expect(prisma.foodSchedule.upsert.mock.calls[0][0].where).toEqual({ userId_mealType: { userId: 'u1', mealType: 'DINNER' } });
    expect(res).toEqual({ mealType: 'DINNER', scheduledTime: '20:00', reminderEnabled: true, isDefault: false });
  });
});
