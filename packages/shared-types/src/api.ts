/** Contrato de respuesta de la API. Fuente: docs/ESPECIFICACION.md §8. */

export interface ApiSuccess<T> {
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiList<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  error: string;
  details?: ApiErrorDetail[];
}
