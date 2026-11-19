import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Search, Utensils } from 'lucide-react';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { coachRoutes } from '@/app/routes';
import { formatDate } from '@/utils/format';
import { plansApi } from './nutritionApi';

const LIMIT = 12;
type Kind = '' | 'plan' | 'template' | 'archived';

/** HU-11 · C06: listado de planes nutricionales. */
export function PlansListPage() {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind>('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim());
  const params = {
    page,
    limit: LIMIT,
    search: debounced || undefined,
    template: kind === 'template' ? ('true' as const) : kind === 'plan' ? ('false' as const) : undefined,
    active: kind === 'archived' ? ('false' as const) : ('true' as const),
  };
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['nutrition-plans', params],
    queryFn: () => plansApi.list(params),
    placeholderData: keepPreviousData,
  });
  const filtered = !!debounced || !!kind;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Planes nutricionales</h1>
        <Link to={coachRoutes.nutritionPlansCreate}>
          <AppButton>
            <Plus className="size-4" aria-hidden="true" /> Crear plan
          </AppButton>
        </Link>
      </div>

      <AppCard>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neo-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar plan por nombre"
              placeholder="Buscar plan por nombre"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="min-h-11 w-full rounded-neo-input border border-neo-border bg-neo-surface pl-9 pr-3 text-sm"
            />
          </div>
          <select
            aria-label="Filtrar por tipo"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setPage(1);
            }}
            className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm"
          >
            <option value="">Todos los activos</option>
            <option value="plan">Planes</option>
            <option value="template">Plantillas</option>
            <option value="archived">Archivados</option>
          </select>
        </div>
      </AppCard>

      {isPending ? (
        <AppCard>
          <SkeletonLoader lines={5} />
        </AppCard>
      ) : isError ? (
        <ErrorState message="No pudimos cargar los planes." onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        filtered ? (
          <EmptyState icon={<Search className="size-8" aria-hidden="true" />} title="Sin resultados" description="Ningún plan coincide con la búsqueda o el filtro." />
        ) : (
          <EmptyState
            icon={<Utensils className="size-8" aria-hidden="true" />}
            title="Aún no tienes planes"
            description="Crea un plan semanal con sus comidas y alimentos para poder asignarlo."
            action={
              <Link to={coachRoutes.nutritionPlansCreate}>
                <AppButton>Crear plan</AppButton>
              </Link>
            }
          />
        )
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((p) => (
              <li key={p.id} className="rounded-neo-card border border-neo-border bg-neo-surface p-4 shadow-neo-card">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base">{p.name}</h3>
                  <div className="flex flex-wrap justify-end gap-1">
                    {p.isTemplate && <AppBadge tone="info">Plantilla</AppBadge>}
                    {!p.isActive && <AppBadge tone="neutral">Archivado</AppBadge>}
                  </div>
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-neo-muted">{p.description}</p>}
                <p className="mt-2 text-xs text-neo-muted">
                  {p.publishedVersions} {p.publishedVersions === 1 ? 'versión publicada' : 'versiones publicadas'}
                  {p.hasDraft ? ' · con borrador' : ''} · Actualizado {formatDate(p.updatedAt)}
                </p>
                <Link to={coachRoutes.nutritionPlan(p.id)} className="mt-3 block">
                  <AppButton variant="secondary" fullWidth aria-label={`Abrir ${p.name}`}>
                    Abrir
                  </AppButton>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-neo-muted">
              Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total} planes
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
