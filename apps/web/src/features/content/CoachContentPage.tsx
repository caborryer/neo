import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { ContentCategory, type ContentDto } from '@neo/shared-types';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Modal } from '@/components/ui/Modal';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { coachRoutes } from '@/app/routes';
import { contentApi } from './contentApi';
import { ContentThumb } from './ContentThumb';
import { CONTENT_CATEGORY_LABEL, CONTENT_TYPE_LABEL } from './labels';

const LIMIT = 12;
const date = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/** C04 · HU-33: la Coach crea, edita, publica, despublica y elimina contenido. */
export function CoachContentPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [published, setPublished] = useState<'' | 'true' | 'false'>('');
  const [category, setCategory] = useState<'' | ContentCategory>('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<ContentDto | null>(null);
  const debounced = useDebouncedValue(search.trim());
  const params = { page, limit: LIMIT, search: debounced || undefined, published: published || undefined, category: category || undefined };

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['content', params],
    queryFn: () => contentApi.list(params),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['content'] });
  const toggle = useMutation({
    mutationFn: ({ id, published: next }: { id: string; published: boolean }) => contentApi.update(id, { published: next }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => contentApi.remove(id),
    onSuccess: async () => {
      setToDelete(null);
      await refresh();
    },
  });

  const filtered = !!debounced || !!published || !!category;
  const select = 'min-h-11 rounded-neo-input border border-neo-border bg-neo-surface px-3 text-sm';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1>Contenido</h1>
        <Link to={coachRoutes.contentCreate}>
          <AppButton>
            <Plus className="size-4" aria-hidden="true" /> Crear contenido
          </AppButton>
        </Link>
      </div>

      <AppCard>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neo-muted" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar contenido por título"
              placeholder="Buscar contenido por título"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="min-h-11 w-full rounded-neo-input border border-neo-border bg-neo-surface pl-9 pr-3 text-sm"
            />
          </div>
          <select aria-label="Filtrar por categoría" value={category} onChange={(e) => { setCategory(e.target.value as '' | ContentCategory); setPage(1); }} className={select}>
            <option value="">Todas las categorías</option>
            {Object.values(ContentCategory).map((c) => (
              <option key={c} value={c}>{CONTENT_CATEGORY_LABEL[c]}</option>
            ))}
          </select>
          <select aria-label="Filtrar por publicación" value={published} onChange={(e) => { setPublished(e.target.value as '' | 'true' | 'false'); setPage(1); }} className={select}>
            <option value="">Todos</option>
            <option value="true">Publicados</option>
            <option value="false">Borradores</option>
          </select>
        </div>
      </AppCard>

      {isPending ? (
        <AppCard><SkeletonLoader lines={5} /></AppCard>
      ) : isError ? (
        <ErrorState message="No pudimos cargar el contenido." onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        filtered ? (
          <EmptyState icon={<Search className="size-8" aria-hidden="true" />} title="Sin resultados" description="Ningún contenido coincide con la búsqueda o los filtros." />
        ) : (
          <EmptyState
            icon={<BookOpen className="size-8" aria-hidden="true" />}
            title="Aún no tienes contenido"
            description="Crea recetas, tips, artículos o videos para tus usuarias."
            action={<Link to={coachRoutes.contentCreate}><AppButton>Crear contenido</AppButton></Link>}
          />
        )
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((c) => (
              <li key={c.id} className="overflow-hidden rounded-neo-card border border-neo-border bg-neo-surface shadow-neo-card">
                <ContentThumb item={c} />
                <div className="flex flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base">{c.title}</h3>
                    <AppBadge tone={c.published ? 'success' : 'neutral'}>{c.published ? 'Publicado' : 'Borrador'}</AppBadge>
                  </div>
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-neo-muted">
                    <span>{CONTENT_CATEGORY_LABEL[c.category]}</span>
                    <span>{CONTENT_TYPE_LABEL[c.type]}</span>
                    <span>{date(c.createdAt)}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Link to={coachRoutes.contentEdit(c.id)} className="flex-1">
                      <AppButton variant="secondary" fullWidth aria-label={`Editar ${c.title}`}>Editar</AppButton>
                    </Link>
                    <AppButton
                      variant="ghost"
                      loading={toggle.isPending && toggle.variables?.id === c.id}
                      onClick={() => toggle.mutate({ id: c.id, published: !c.published })}
                      aria-label={`${c.published ? 'Despublicar' : 'Publicar'} ${c.title}`}
                    >
                      {c.published ? 'Despublicar' : 'Publicar'}
                    </AppButton>
                    <AppButton variant="ghost" onClick={() => setToDelete(c)} aria-label={`Eliminar ${c.title}`}>Eliminar</AppButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {toggle.isError && <p role="alert" className="mt-3 text-sm text-red-700">No pudimos cambiar la publicación. Intenta de nuevo.</p>}
          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-neo-muted">Página {data.meta.page} de {data.meta.totalPages} · {data.meta.total} contenidos</span>
            <div className="flex gap-2">
              <AppButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" aria-hidden="true" /></AppButton>
              <AppButton variant="secondary" disabled={page >= data.meta.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" aria-hidden="true" /></AppButton>
            </div>
          </nav>
        </div>
      )}

      <Modal open={!!toDelete} title="Eliminar contenido" onClose={() => setToDelete(null)}>
        <p className="text-sm">
          ¿Eliminar <strong>{toDelete?.title}</strong>? Esta acción no se puede deshacer. Si solo quieres ocultarlo, usa «Despublicar».
        </p>
        {remove.isError && <p role="alert" className="mt-2 text-sm text-red-700">No pudimos eliminarlo. Intenta de nuevo.</p>}
        <div className="mt-4 flex justify-end gap-2">
          <AppButton variant="secondary" onClick={() => setToDelete(null)}>Cancelar</AppButton>
          <AppButton variant="danger" loading={remove.isPending} onClick={() => toDelete && remove.mutate(toDelete.id)}>Eliminar</AppButton>
        </div>
      </Modal>
    </div>
  );
}
