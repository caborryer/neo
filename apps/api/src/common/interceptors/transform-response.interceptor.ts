import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/**
 * Envuelve las respuestas en { data } (§8). Si el controlador ya devuelve
 * { data, meta } (listados paginados) se respeta tal cual.
 */
@Injectable()
export class TransformResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value === undefined || value === null) return { data: null };
        if (value instanceof StreamableFile) return value; // descargas de archivos: sin envoltorio
        if (typeof value === 'object' && 'data' in (value as object)) return value;
        return { data: value };
      }),
    );
  }
}
