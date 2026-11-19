import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Plus, Search, Trophy, Users } from 'lucide-react';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { coachRoutes } from '@/app/routes';
import { coachChallengesApi } from './challengesApi';
import { PhaseBadge, fmtRange } from './labels';

const LIMIT = 12;

/** C08 · HU-29: la Coach crea retos, los publica y consulta el avance. */
export function CoachChallengesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [published, setPublished] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim());
  const params = { page, limit: LIMIT, search: debounced || undefined, published: published || undefined };

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['coach-challenges', params],
    queryFn: () => coachChallengesApi.list(params),
    placeholderData: keepPreviousData,
  });
  const toggle = useMutation({
    mutationFn: ({ id, published: next }: { id: string; published: boolean }) => coachChallengesApi.update(id, { published: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coach-challenges'] }),
  });
  const filtered = !!debounced || !!published;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Retos</h1>
        <Link to={coachRoutes.challengesCreate}>
          <AppButton><Plus className="size-4" aria-hidden="true" /> Crear reto</AppButton>
        </Link>
      </div>

      <AppCard>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neo-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar reto por nombre"
              placeholder="Buscar reto por nombre"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="min-h-11 w-full rounded-neo-input border border-neo-border bg-neo-surface pl-9 pr-3 text-sm"
            />
          </div>
          <select
            aria-label="Filtrar por publicación"
            value={published}
            onChange={(e) => { setPublished(e.target.value as '' | 'true' | 'false'); setPage(1); }}
            className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm"
          >
            <option value="">Todos</option>
            <option value="true">Publicados</option>
            <option value="false">Borradores</option>
          </select>
        </div>
      </AppCard>

      {isPending ? (
        <AppCard><SkeletonLoader lines={5} /></AppCard>
      ) : isError ? (
        <ErrorState message="No pudimos cargar los retos." onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        filtered ? (
          <EmptyState icon={<Search className="size-8" aria-hidden="true" />} title="Sin resultados" description="Ningún reto coincide con la búsqueda o el filtro." />
        ) : (
          <EmptyState
            icon={<Trophy className="size-8" aria-hidden="true" />}
            title="Aún no tienes retos"
            description="Crea un reto con una meta de sesiones y fechas para motivar a tus usuarias."
            action={<Link to={coachRoutes.challengesCreate}><AppButton>Crear reto</AppButton></Link>}
          />
        )
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.data.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 rounded-neo-card border border-neo-border bg-neo-surface p-4 shadow-neo-card">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base">
                    <Link to={coachRoutes.challenge(c.id)} className="hover:underline">{c.name}</Link>
                  </h3>
                  <AppBadge tone={c.published ? 'success' : 'neutral'}>{c.published ? 'Publicado' : 'Borrador'}</AppBadge>
                </div>
                <p className="text-xs text-neo-muted">{c.category} · {fmtRange(c.startDate, c.endDate)}</p>
                <p className="flex flex-wrap items-center gap-3 text-sm">
                  <span>Meta: <strong>{c.goal}</strong> sesiones</span>
                  <span className="inline-flex items-center gap-1"><Users className="size-4" aria-hidden="true" /> {c.participantCount} participantes</span>
                  <PhaseBadge phase={c.phase} />
                </p>
                <div className="mt-1 flex gap-2">
                  <Link to={coachRoutes.challenge(c.id)} className="flex-1">
                    <AppButton variant="secondary" fullWidth aria-label={`Ver progreso de ${c.name}`}>Ver progreso</AppButton>
                  </Link>
                  <Link to={coachRoutes.challengeEdit(c.id)}>
                    <AppButton variant="ghost" aria-label={`Editar ${c.name}`}>Editar</AppButton>
                  </Link>
                  <AppButton
                    variant="ghost"
                    loading={toggle.isPending && toggle.variables?.id === c.id}
                    onClick={() => toggle.mutate({ id: c.id, published: !c.published })}
                    aria-label={`${c.published ? 'Despublicar' : 'Publicar'} ${c.name}`}
                  >
                    {c.published ? 'Despublicar' : 'Publicar'}
                  </AppButton>
                </div>
              </li>
            ))}
          </ul>
          {toggle.isError && <p role="alert" className="mt-3 text-sm text-red-700">No pudimos cambiar la publicación. Intenta de nuevo.</p>}
          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-neo-muted">Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total} retos</span>
            <div className="flex gap-2">
              <AppButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" aria-hidden="true" /></AppButton>
              <AppButton variant="secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" aria-hidden="true" /></AppButton>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
