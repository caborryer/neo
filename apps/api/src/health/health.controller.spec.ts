import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reporta ok cuando la base responde', async () => {
    const ctrl = new HealthController({ $queryRaw: jest.fn().mockResolvedValue([1]) } as never);
    expect(await ctrl.check()).toMatchObject({ status: 'ok', database: true });
  });

  it('reporta degraded cuando la base falla', async () => {
    const ctrl = new HealthController({ $queryRaw: jest.fn().mockRejectedValue(new Error('x')) } as never);
    expect(await ctrl.check()).toMatchObject({ status: 'degraded', database: false });
  });
});
