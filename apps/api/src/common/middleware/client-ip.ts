import type { NextFunction, Request, Response } from 'express';

/**
 * Detrás de una plataforma como Railway, la IP real de la usuaria llega en una cabecera que el borde de la
 * plataforma sobrescribe (p. ej. `x-real-ip`) y no en la conexión TCP. Con CLIENT_IP_HEADER configurada, `req.ip`
 * (que usan el límite de intentos y el registro de sesiones) pasa a salir de esa cabecera.
 *
 * Solo debe activarse cuando TODO el tráfico llega a la API a través de ese borde/proxy de confianza: si la API
 * fuera accesible directamente, cualquiera podría enviar la cabecera y esquivar el límite de intentos.
 */
export function clientIpFromHeader(header: string | undefined) {
  const name = header?.trim().toLowerCase();
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (name) {
      const raw = req.headers[name];
      // Si la cabecera trae una lista (x-forwarded-for), el primer valor es el de la usuaria.
      const first = (Array.isArray(raw) ? raw[0] : raw)?.split(',')[0]?.trim();
      if (first && first.length <= 45 && /^[0-9a-fA-F:.]+$/.test(first)) {
        Object.defineProperty(req, 'ip', { value: first, configurable: true });
      }
    }
    next();
  };
}
