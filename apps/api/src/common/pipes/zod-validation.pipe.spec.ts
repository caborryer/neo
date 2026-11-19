import { BadRequestException } from '@nestjs/common';
import { loginSchema } from '@neo/validation';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(loginSchema);
  it('devuelve el valor normalizado', () => {
    expect(pipe.transform({ email: ' A@B.co ', password: 'x' })).toEqual({ email: 'a@b.co', password: 'x' });
  });
  it('lanza 400 con details[{field,message}]', () => {
    try {
      pipe.transform({ email: 'mal' });
      fail('debía lanzar');
    } catch (e) {
      const body = (e as BadRequestException).getResponse() as any;
      expect(body.details).toEqual(expect.arrayContaining([{ field: 'email', message: 'Correo inválido' }]));
    }
  });
  it('un body ausente se trata como objeto vacío', () => {
    expect(() => pipe.transform(undefined)).toThrow(BadRequestException);
  });
});
