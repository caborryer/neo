import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Clock, Dumbbell, Plus, Search } from 'lucide-react';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { coachRoutes } from '@/app/routes';
import { CATEGORY_LABEL, DIFFICULTY_LABEL } from './labels';
import { workoutsApi } from './workoutsApi';
import { youtubeThumbnail } from './YouTubePlayer';

const LIMIT = 12;

export function WorkoutsListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [published, setPublished] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim());
  const params = { page, limit: LIMIT, search: debounced || undefined, published: published || undefined };

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['workouts', params],
    queryFn: () => workoutsApi.list(params),
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) => workoutsApi.update(id, { isPublished }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workouts'] }),
  });

  const filtered = !!debounced || !!published;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Entrenamientos</h1>
        <Link to={coachRoutes.workoutsCreate}>
          <AppButton>
            <Plus className="size-4" aria-hidden="true" /> Crear clase
          </AppButton>
        </Link>
      </div>

      <AppCard>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neo-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar clase por título"
              placeholder="Buscar clase por título"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="min-h-11 w-full rounded-neo-input border border-neo-border bg-neo-surface pl-9 pr-3 text-sm"
            />
          </div>
          <select
            aria-label="Filtrar por publicación"
            value={published}
            onChange={(e) => {
              setPublished(e.target.value as '' | 'true' | 'false');
              setPage(1);
            }}
            className="min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm"
          >
            <option value="">Todas</option>
            <option value="true">Publicadas</option>
            <option value="false">Borradores</option>
          </select>
        </div>
      </AppCard>

      {isPending ? (
        <AppCard>
          <SkeletonLoader lines={5} />
        </AppCard>
      ) : isError ? (
        <ErrorState message="No pudimos cargar las clases." onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        filtered ? (
          <EmptyState icon={<Search className="size-8" aria-hidden="true" />} title="Sin resultados" description="Ninguna clase coincide con la búsqueda o el filtro." />
        ) : (
          <EmptyState
            icon={<Dumbbell className="size-8" aria-hidden="true" />}
            title="Aún no tienes clases"
            description="Crea una clase con su video de YouTube para poder asignarla."
            action={
              <Link to={coachRoutes.workoutsCreate}>
                <AppButton>Crear clase</AppButton>
              </Link>
            }
          />
        )
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((w) => (
              <li key={w.id} className="overflow-hidden rounded-neo-card border border-neo-border bg-neo-surface shadow-neo-card">
                <img src={youtubeThumbnail(w.videoId)} alt="" loading="lazy" className="aspect-video w-full bg-neo-neutral object-cover" />
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base">{w.title}</h3>
                    <AppBadge tone={w.isPublished ? 'success' : 'neutral'}>{w.isPublished ? 'Publicada' : 'Borrador'}</AppBadge>
                  </div>
                  <p className="flex items-center gap-3 text-xs text-neo-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden="true" /> {w.durationMinutes} min
                    </span>
                    <span>{DIFFICULTY_LABEL[w.difficulty]}</span>
                    <span>{CATEGORY_LABEL[w.category]}</span>
                  </p>
                  <div className="mt-1 flex gap-2">
                    <Link to={coachRoutes.workoutEdit(w.id)} className="flex-1">
                      <AppButton variant="secondary" fullWidth aria-label={`Editar ${w.title}`}>
                        Editar
                      </AppButton>
                    </Link>
                    <AppButton
                      variant="ghost"
                      loading={toggle.isPending && toggle.variables?.id === w.id}
                      onClick={() => toggle.mutate({ id: w.id, isPublished: !w.isPublished })}
                      aria-label={`${w.isPublished ? 'Despublicar' : 'Publicar'} ${w.title}`}
                    >
                      {w.isPublished ? 'Despublicar' : 'Publicar'}
                    </AppButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {toggle.isError && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              No pudimos cambiar la publicación. Intenta de nuevo.
            </p>
          )}
          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-neo-muted">
              Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total} clases
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
