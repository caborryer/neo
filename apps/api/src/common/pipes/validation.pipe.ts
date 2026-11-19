import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import type { ApiErrorDetail } from '@neo/shared-types';

export function flattenErrors(errors: ValidationError[], parent = ''): ApiErrorDetail[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own = Object.values(e.constraints ?? {}).map((message) => ({ field, message }));
    return [...own, ...flattenErrors(e.children ?? [], field)];
  });
}

/** ValidationPipe global (RNF-12): rechaza campos desconocidos y entrega details por campo. */
export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException({ message: 'Validation failed', details: flattenErrors(errors) }),
  });
