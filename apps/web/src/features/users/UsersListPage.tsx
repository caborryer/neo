import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Search, Users } from 'lucide-react';
import { UserStatus } from '@neo/shared-types';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { coachRoutes } from '@/app/routes';
import { formatDate } from '@/utils/format';
import { StatusBadge, STATUS_LABEL, isExpired } from './userStatus';
import { usersApi } from './usersApi';

const LIMIT = 10;

export function UsersListPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());

  const params = { page, limit: LIMIT, search: debouncedSearch || undefined, status: status || undefined, sortBy: 'createdAt', sortOrder: 'desc' as const };
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['users', params],
    queryFn: () => usersApi.list(params),
    placeholderData: keepPreviousData,
  });

  const filtered = !!debouncedSearch || !!status;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Usuarias</h1>
        <Link to={coachRoutes.usersCreate}>
          <AppButton>
            <Plus className="size-4" aria-hidden="true" /> Crear usuaria
          </AppButton>
        </Link>
      </div>

      <AppCard>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neo-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar por nombre o correo"
              placeholder="Buscar por nombre o correo"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="min-h-11 w-full rounded-neo-input border border-neo-border bg-neo-surface pl-9 pr-3 text-sm"
            />
          </div>
          <select
            aria-label="Filtrar por estado"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as UserStatus | '');
              setPage(1);
            }}
            className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm"
          >
            <option value="">Todos los estados</option>
            {Object.values(UserStatus).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </AppCard>

      {isPending ? (
        <AppCard>
          <SkeletonLoader lines={5} />
        </AppCard>
      ) : isError ? (
        <ErrorState message="No pudimos cargar las usuarias." onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        filtered ? (
          <EmptyState icon={<Search className="size-8" aria-hidden="true" />} title="Sin resultados" description="Ninguna usuaria coincide con la búsqueda o el filtro." />
        ) : (
          <EmptyState
            icon={<Users className="size-8" aria-hidden="true" />}
            title="Aún no tienes usuarias"
            description="Crea la primera y le llegará una invitación por correo."
            action={
              <Link to={coachRoutes.usersCreate}>
                <AppButton>Crear usuaria</AppButton>
              </Link>
            }
          />
        )
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          {/* Escritorio: tabla */}
          <div className="hidden overflow-hidden rounded-neo-card border border-neo-border bg-neo-surface shadow-neo-card md:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Listado de usuarias</caption>
              <thead className="bg-neo-neutral text-xs uppercase text-neo-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Nombre</th>
                  <th scope="col" className="px-4 py-3">Estado</th>
                  <th scope="col" className="px-4 py-3">Meta semanal</th>
                  <th scope="col" className="px-4 py-3">Entrenamientos</th>
                  <th scope="col" className="px-4 py-3">Acceso hasta</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((u) => (
                  <tr key={u.id} className="border-t border-neo-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-neo-muted">{u.email}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                    <td className="px-4 py-3">{u.weeklyGoal} / semana</td>
                    {/* Se completa cuando existan las sesiones de entrenamiento (Fases 2 y 4). */}
                    <td className="px-4 py-3 text-neo-muted">—</td>
                    <td className="px-4 py-3">
                      {formatDate(u.accessExpiresAt)}
                      {isExpired(u.accessExpiresAt) && <span className="ml-2 text-xs font-semibold text-red-700">Vencido</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to={coachRoutes.user(u.id)} className="font-medium text-neo-primary-dark hover:underline" aria-label={`Ver a ${u.firstName} ${u.lastName}`}>
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil: tarjetas */}
          <ul className="flex flex-col gap-3 md:hidden">
            {data.data.map((u) => (
              <li key={u.id}>
                <Link to={coachRoutes.user(u.id)} className="block rounded-neo-card border border-neo-border bg-neo-surface p-4 shadow-neo-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-neo-muted">{u.email}</p>
                    </div>
                    <StatusBadge status={u.status} />
                  </div>
                  <p className="mt-2 text-xs text-neo-muted">
                    Meta: {u.weeklyGoal}/semana · Acceso hasta: {formatDate(u.accessExpiresAt)}
                    {isExpired(u.accessExpiresAt) && ' (vencido)'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-neo-muted">
              Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total} usuarias
            </span>
            <div className="flex gap-2">
              <AppButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior">
                <ChevronLeft className="size-4" aria-hidden="true" />
              </AppButton>
              <AppButton variant="secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente">
                <ChevronRight className="size-4" aria-hidden="true" />
              </AppButton>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
