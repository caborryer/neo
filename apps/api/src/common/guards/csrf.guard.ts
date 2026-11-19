import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'neo-web';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protección CSRF para sesiones con cookies (§10.1): toda petición que modifica estado debe
 * llevar un header personalizado. Un formulario de otro sitio no puede enviarlo, y un fetch
 * cross-origin con ese header exige un preflight que CORS solo permite a WEB_ORIGIN.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (req.header(CSRF_HEADER) === CSRF_VALUE) return true;
    throw new ForbiddenException('Solicitud no permitida');
  }
}
