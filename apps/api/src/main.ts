import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { API_PREFIX } from '@neo/config';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/pipes/validation.pipe';
import { requestLogger } from './common/middleware/request-logger';
import type { Application } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Detrás de nginx: sin esto, req.ip sería siempre la del proxy y el límite de intentos afectaría a todas por igual.
  const proxies = config.get<number>('TRUST_PROXY') ?? 0;
  if (proxies > 0) (app.getHttpAdapter().getInstance() as Application).set('trust proxy', proxies);

  app.setGlobalPrefix(API_PREFIX);
  if (config.get<boolean>('HTTP_LOG') !== false) app.use(requestLogger());
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: config.get<string>('WEB_ORIGIN'), credentials: true });
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  const port = config.get<number>('API_PORT') ?? 3000;
  await app.listen(port);
  new Logger('Neo API').log(`Escuchando en http://localhost:${port}/${API_PREFIX}`);
}

void bootstrap();
