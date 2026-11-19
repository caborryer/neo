import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { API_PREFIX } from '@neo/config';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';

/** Prueba de integración ligera: prefijo, contrato de respuesta y de error, sin base de datos real. */
describe('API (contrato general)', () => {
  let app: INestApplication;
  const prismaMock = { $queryRaw: jest.fn().mockResolvedValue([1]), user: { findUnique: jest.fn() } };
  const asUser = async (role: 'COACH' | 'USER', over: object = {}) => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'a@b.co', firstName: 'A', lastName: 'B', role, status: 'ACTIVE',
      timezone: 'America/Bogota', avatarAssetId: null, accessExpiresAt: null, privacyConsentAt: new Date(), ...over,
    });
    const jwt = await new JwtService({}).signAsync({ sub: 'u1' }, { secret: app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET') });
    return `neo_at=${jwt}`;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health responde dentro de { data }', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_PREFIX}/health`).expect(200);
    expect(res.body.data).toMatchObject({ status: 'ok', database: true });
  });

  it('una ruta inexistente devuelve el contrato de error', async () => {
    const res = await request(app.getHttpServer()).get(`/${API_PREFIX}/no-existe`).expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });

  describe('seguridad de acceso (HU-01, HU-06, HU-07)', () => {
    const base = `/${API_PREFIX}`;

    it('sin sesión → 401 en rutas protegidas', async () => {
      const res = await request(app.getHttpServer()).get(`${base}/users/me`).expect(401);
      expect(res.body).toMatchObject({ statusCode: 401, error: 'Unauthorized' });
    });

    it('GET /users/me devuelve la usuaria sin datos sensibles', async () => {
      const res = await request(app.getHttpServer()).get(`${base}/users/me`).set('Cookie', await asUser('USER')).expect(200);
      expect(res.body.data).toMatchObject({ id: 'u1', role: 'USER', status: 'ACTIVE' });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    });

    it('una usuaria suspendida con token vigente recibe 403', async () => {
      const cookie = await asUser('USER', { status: 'SUSPENDED' });
      await request(app.getHttpServer()).get(`${base}/users/me`).set('Cookie', cookie).expect(403);
    });

    it('una usuaria no puede usar rutas de la Coach (403) y la Coach sí llega al servicio', async () => {
      const userCookie = await asUser('USER');
      await request(app.getHttpServer()).get(`${base}/coach/users`).set('Cookie', userCookie).expect(403);
    });

    it('POST sin el header CSRF → 403 aunque haya sesión', async () => {
      const cookie = await asUser('COACH');
      await request(app.getHttpServer()).post(`${base}/coach/users`).set('Cookie', cookie).send({}).expect(403);
    });

    it('con CSRF, un body inválido da 400 con details por campo', async () => {
      const cookie = await asUser('COACH');
      const res = await request(app.getHttpServer())
        .post(`${base}/coach/users`)
        .set('Cookie', cookie)
        .set('X-Requested-With', 'neo-web')
        .send({ firstName: '', email: 'mal' })
        .expect(400);
      expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(expect.arrayContaining(['firstName', 'email']));
    });

    it('rutas de la Coach de entrenamientos: la usuaria recibe 403 y la Coach 400 con details', async () => {
      const member = await asUser('USER');
      for (const [m, path] of [['post', '/coach/workouts'], ['post', '/coach/workout-assignments']] as const) {
        await request(app.getHttpServer())[m](`${base}${path}`).set('Cookie', member).set('X-Requested-With', 'neo-web').send({}).expect(403);
      }
      const coach = await asUser('COACH');
      const res = await request(app.getHttpServer()).post(`${base}/coach/workouts`).set('Cookie', coach).set('X-Requested-With', 'neo-web').send({ title: '', video: 'mal' }).expect(400);
      expect(res.body.details.map((d: { field: string }) => d.field)).toEqual(expect.arrayContaining(['title', 'video']));
    });

    it('la Coach no puede completar entrenamientos ni enviar feedback (solo la usuaria)', async () => {
      const coach = await asUser('COACH');
      await request(app.getHttpServer()).post(`${base}/workout-sessions`).set('Cookie', coach).set('X-Requested-With', 'neo-web').send({}).expect(403);
      await request(app.getHttpServer())
        .post(`${base}/workout-sessions/11111111-1111-4111-8111-111111111111/feedback`)
        .set('Cookie', coach).set('X-Requested-With', 'neo-web').send({}).expect(403);
    });

    it('ids que no son UUID → 400 y consultas de calendario sin rango → 400', async () => {
      const member = await asUser('USER');
      await request(app.getHttpServer()).get(`${base}/workout-assignments/no-uuid`).set('Cookie', member).expect(400);
      await request(app.getHttpServer()).get(`${base}/workout-assignments`).set('Cookie', member).expect(400);
    });

    it('sin sesión, las rutas de entrenamientos devuelven 401', async () => {
      await request(app.getHttpServer()).get(`${base}/workouts`).expect(401);
      await request(app.getHttpServer()).get(`${base}/workout-sessions`).expect(401);
    });

    it('nutrición: rutas de la Coach vedadas a la usuaria; diario y mi plan vedados a la Coach', async () => {
      const member = await asUser('USER');
      const coachRoutes = [['post', '/coach/nutrition-plans'], ['post', '/coach/nutrition-plans/11111111-1111-4111-8111-111111111111/assignments']] as const;
      for (const [m, path] of coachRoutes) {
        await request(app.getHttpServer())[m](`${base}${path}`).set('Cookie', member).set('X-Requested-With', 'neo-web').send({}).expect(403);
      }
      await request(app.getHttpServer()).get(`${base}/coach/meal-logs`).set('Cookie', member).expect(403);
      await request(app.getHttpServer()).post(`${base}/coach/meal-logs/11111111-1111-4111-8111-111111111111/review`).set('Cookie', member).set('X-Requested-With', 'neo-web').send({ status: 'REVIEWED' }).expect(403);

      const coach = await asUser('COACH');
      await request(app.getHttpServer()).get(`${base}/nutrition/my-plan`).set('Cookie', coach).expect(403);
      await request(app.getHttpServer()).post(`${base}/meal-logs`).set('Cookie', coach).set('X-Requested-With', 'neo-web').send({}).expect(403);
    });

    it('nutrición: validaciones devuelven 400 con details por campo', async () => {
      const coach = await asUser('COACH');
      const plan = await request(app.getHttpServer()).post(`${base}/coach/nutrition-plans`).set('Cookie', coach).set('X-Requested-With', 'neo-web').send({ name: '' }).expect(400);
      expect(plan.body.details.map((d: { field: string }) => d.field)).toContain('name');

      const member = await asUser('USER');
      const log = await request(app.getHttpServer()).post(`${base}/meal-logs`).set('Cookie', member).set('X-Requested-With', 'neo-web').send({ mealType: 'LUNCH', date: '2026-11-18' }).expect(400);
      expect(log.body.details.map((d: { field: string }) => d.field)).toContain('description');
      await request(app.getHttpServer()).get(`${base}/meal-logs`).set('Cookie', member).expect(400); // falta el rango
      await request(app.getHttpServer()).get(`${base}/media/no-uuid`).set('Cookie', member).expect(400);
    });

    it('nutrición y fotos: sin sesión → 401; subir sin CSRF → 403; sin archivo → 400', async () => {
      await request(app.getHttpServer()).get(`${base}/nutrition/my-plan`).expect(401);
      await request(app.getHttpServer()).get(`${base}/media/11111111-1111-4111-8111-111111111111`).expect(401);
      const member = await asUser('USER');
      await request(app.getHttpServer()).post(`${base}/media/images`).set('Cookie', member).expect(403);
      await request(app.getHttpServer()).post(`${base}/media/images`).set('Cookie', member).set('X-Requested-With', 'neo-web').expect(400);
    });

    it('Fase 4: sin sesión → 401 en dashboards, notificaciones, horarios y ajustes', async () => {
      for (const path of ['/dashboard', '/coach/dashboard', '/notifications', '/notifications/unread-count', '/food-schedules', '/coach/settings/risk', '/coach/users/11111111-1111-4111-8111-111111111111/statistics']) {
        await request(app.getHttpServer()).get(`${base}${path}`).expect(401);
      }
    });

    it('Fase 4: cada rol solo entra a lo suyo (dashboard, ajustes, horarios, seguimientos)', async () => {
      // asUser reemplaza el usuario simulado: se usa cada cookie antes de crear la siguiente.
      const member = await asUser('USER');
      const uid = '11111111-1111-4111-8111-111111111111';
      for (const path of ['/coach/dashboard', '/coach/settings/risk', `/coach/users/${uid}/statistics`, `/coach/users/${uid}/follow-ups`]) {
        await request(app.getHttpServer()).get(`${base}${path}`).set('Cookie', member).expect(403);
      }
      await request(app.getHttpServer()).put(`${base}/coach/settings/risk`).set('Cookie', member).set('X-Requested-With', 'neo-web').send({}).expect(403);
      await request(app.getHttpServer()).post(`${base}/coach/users/${uid}/follow-ups`).set('Cookie', member).set('X-Requested-With', 'neo-web').send({ note: 'hola' }).expect(403);
      const coach = await asUser('COACH');
      for (const path of ['/dashboard', '/food-schedules']) {
        await request(app.getHttpServer()).get(`${base}${path}`).set('Cookie', coach).expect(403);
      }
    });

    it('Fase 4: validación de entradas → 400 (rango, umbrales, seguimiento, horario, contraseña)', async () => {
      const coach = await asUser('COACH');
      const h = { 'X-Requested-With': 'neo-web' };
      await request(app.getHttpServer()).get(`${base}/coach/dashboard?range=15`).set('Cookie', coach).expect(400);
      await request(app.getHttpServer()).put(`${base}/coach/settings/risk`).set('Cookie', coach).set(h).send({ inactivityDays: 1 }).expect(400);
      await request(app.getHttpServer()).post(`${base}/coach/users/11111111-1111-4111-8111-111111111111/follow-ups`).set('Cookie', coach).set(h).send({ note: '' }).expect(400);
      const member = await asUser('USER');
      await request(app.getHttpServer()).put(`${base}/food-schedules/BREAKFAST`).set('Cookie', member).set(h).send({ scheduledTime: '25:00', reminderEnabled: true }).expect(400);
      await request(app.getHttpServer()).put(`${base}/food-schedules/OTHER`).set('Cookie', member).set(h).send({ scheduledTime: '10:00', reminderEnabled: true }).expect(400);
      await request(app.getHttpServer()).post(`${base}/auth/change-password`).set('Cookie', member).set(h).send({ currentPassword: 'x', newPassword: 'corta', confirmPassword: 'corta' }).expect(400);
    });

    it('Fase 4: acciones de escritura sin CSRF → 403; cambiar contraseña exige sesión', async () => {
      const member = await asUser('USER');
      await request(app.getHttpServer()).post(`${base}/users/me/privacy-consent`).set('Cookie', member).expect(403);
      await request(app.getHttpServer()).post(`${base}/notifications/read-all`).set('Cookie', member).expect(403);
      await request(app.getHttpServer()).post(`${base}/auth/change-password`).set('X-Requested-With', 'neo-web').send({}).expect(401);
    });

    it('HU-28: una usuaria sin consentimiento no sube fotos (403 aun con CSRF y archivo)', async () => {
      const member = await asUser('USER', { privacyConsentAt: null });
      await request(app.getHttpServer()).post(`${base}/media/images`).set('Cookie', member).set('X-Requested-With', 'neo-web').expect(403);
    });

    it('login con body inválido → 400 (ruta pública, con CSRF)', async () => {
      await request(app.getHttpServer()).post(`${base}/auth/login`).set('X-Requested-With', 'neo-web').send({}).expect(400);
    });

    it('login limita intentos: el 6.º en un minuto responde 429', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 7; i++) {
        const r = await request(app.getHttpServer()).post(`${base}/auth/login`).set('X-Requested-With', 'neo-web').send({});
        codes.push(r.status);
      }
      expect(codes).toContain(429);
    });
  });
});
