import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { API_PREFIX } from '@neo/config';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { clientIpFromHeader } from './common/middleware/client-ip';
import { requestLogger } from './common/middleware/request-logger';
import type { Application } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Detrás de nginx: sin esto, req.ip sería siempre la del proxy y el límite de intentos afectaría a todas por igual.
  const proxies = config.get<number>('TRUST_PROXY') ?? 0;
  if (proxies > 0) (app.getHttpAdapter().getInstance() as Application).set('trust proxy', proxies);

  // Railway: la IP real llega en una cabecera del borde (ver CLIENT_IP_HEADER); debe ir antes del límite de intentos.
  app.use(clientIpFromHeader(config.get<string>('CLIENT_IP_HEADER')));

  app.setGlobalPrefix(API_PREFIX);
  if (config.get<boolean>('HTTP_LOG') !== false) app.use(requestLogger());
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get<string>('WEB_ORIGIN'), credentials: true });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  const port = config.get<number>('PORT') ?? config.get<number>('API_PORT') ?? 3000;
  const host = config.get<string>('API_HOST') ?? '0.0.0.0';
  await app.listen(port, host);
  new Logger('Neo API').log(`Escuchando en ${host}:${port} (/${API_PREFIX})`);
}

void bootstrap();
