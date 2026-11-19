import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

/** Rutas que no se registran: el healthcheck del contenedor llamaría cada pocos segundos. */
const SILENT = /\/health\/?$/;

/**
 * RNF-10: una línea por petición con método, ruta, estado y duración, más un id de petición
 * que también viaja en la cabecera `X-Request-Id` para cruzar el log con lo que ve la usuaria.
 * Nunca registra query string, cuerpo, cookies ni cabeceras (pueden llevar tokens o datos personales).
 */
export function requestLogger(write: (line: string, level: 'log' | 'warn' | 'error') => void = defaultWrite) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const path = (req.originalUrl ?? req.url).split('?')[0] ?? '';
      if (SILENT.test(path)) return;
      const ms = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'log';
      write(`${req.method} ${path} ${res.statusCode} ${ms}ms id=${id}`, level);
    });
    next();
  };
}

function defaultWrite(line: string, level: 'log' | 'warn' | 'error'): void {
  logger[level](line);
}
