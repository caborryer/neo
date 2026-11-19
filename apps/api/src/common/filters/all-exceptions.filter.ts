import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorBody, ApiErrorDetail } from '@neo/shared-types';

const ERROR_NAMES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/** Convierte cualquier excepción al contrato de error de la sección 8. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      // RNF-10: se registra el error sin datos sensibles del request.
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (!(exception instanceof HttpException)) {
      return { statusCode: 500, message: 'Error interno del servidor', error: ERROR_NAMES[500]! };
    }
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    let message = exception.message;
    let details: ApiErrorDetail[] | undefined;

    if (typeof payload === 'object' && payload !== null) {
      const p = payload as { message?: unknown; details?: ApiErrorDetail[] };
      if (Array.isArray(p.details)) details = p.details;
      if (typeof p.message === 'string') message = p.message;
    }
    const error = ERROR_NAMES[statusCode] ?? HttpStatus[statusCode] ?? 'Error';
    return details ? { statusCode, message, error, details } : { statusCode, message, error };
  }
}
