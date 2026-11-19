import { SettingsService } from './settings.service';

function setup(stored: any) {
  const tx: any = { appSetting: { upsert: jest.fn() } };
  const prisma: any = { appSetting: { findUnique: jest.fn().mockResolvedValue(stored) }, $transaction: jest.fn(async (fn: any) => fn(tx)) };
  const audit: any = { record: jest.fn() };
  return { service: new SettingsService(prisma, audit), tx, audit };
}

describe('SettingsService (HU-15)', () => {
  it('sin configuración usa los valores por defecto', async () => {
    expect(await setup(null).service.getRisk()).toEqual({ inactivityDays: 7, consecutiveMissed: 3, noFoodLogDays: 5, adherenceDropPoints: 25 });
  });
  it('lo guardado parcialmente se completa con los valores por defecto', async () => {
    expect(await setup({ key: 'risk', value: { inactivityDays: 10 } }).service.getRisk()).toMatchObject({ inactivityDays: 10, consecutiveMissed: 3 });
  });
  it('un valor corrupto o fuera de rango no rompe: vuelve a los valores por defecto', async () => {
    expect((await setup({ key: 'risk', value: { inactivityDays: 'x' } }).service.getRisk()).inactivityDays).toBe(7);
    expect((await setup({ key: 'risk', value: { inactivityDays: 999 } }).service.getRisk()).inactivityDays).toBe(7);
  });
  it('updateRisk guarda y audita en la misma transacción', async () => {
    const { service, tx, audit } = setup(null);
    const input = { inactivityDays: 10, consecutiveMissed: 4, noFoodLogDays: 6, adherenceDropPoints: 30 };
    expect(await service.updateRisk('c1', input)).toEqual(input);
    expect(tx.appSetting.upsert.mock.calls[0][0]).toMatchObject({ where: { key: 'risk' }, update: { value: input } });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'c1', action: 'RISK_SETTINGS_UPDATED' }), tx);
  });
});
