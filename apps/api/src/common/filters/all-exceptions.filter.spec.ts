import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as never;
  new AllExceptionsFilter().catch(exception, host);
  return { status, json };
}

describe('AllExceptionsFilter', () => {
  it('devuelve el contrato de error con details', () => {
    const { status, json } = run(
      new BadRequestException({ message: 'Validation failed', details: [{ field: 'email', message: 'Invalid email' }] }),
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      message: 'Validation failed',
      error: 'Bad Request',
      details: [{ field: 'email', message: 'Invalid email' }],
    });
  });

  it('mapea 403', () => {
    const { status, json } = run(new ForbiddenException('Acceso denegado'));
    expect(status).toHaveBeenCalledWith(403);
    expect(json.mock.calls[0][0]).toMatchObject({ statusCode: 403, error: 'Forbidden' });
  });

  it('oculta el detalle de errores desconocidos', () => {
    const { status, json } = run(new Error('secreto interno'));
    expect(status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('secreto interno');
  });
});
