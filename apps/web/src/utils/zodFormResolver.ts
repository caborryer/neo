import type { FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * Resolver de react-hook-form basado en los esquemas Zod compartidos con el backend
 * (@neo/validation). `prepare` convierte los valores del formulario (strings) al input del esquema.
 * Los valores devueltos son los del formulario; el envío se arma en el onSubmit.
 */
export function zodFormResolver<T extends FieldValues>(
  schema: ZodType,
  prepare: (values: T) => unknown = (v) => v,
): Resolver<T> {
  return (values) => {
    const result = schema.safeParse(prepare(values));
    if (result.success) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (key && !errors[key]) errors[key] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors } as ReturnType<Resolver<T>> extends Promise<infer R> ? R : never;
  };
}
