import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { ContentCategory } from '@neo/shared-types';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { userRoutes } from '@/app/routes';
import { cn } from '@/utils/cn';
import { contentApi } from './contentApi';
import { ContentThumb } from './ContentThumb';
import { CONTENT_CATEGORY_LABEL, CONTENT_TYPE_LABEL } from './labels';

const LIMIT = 12;

/** Contenido publicado por la Coach (recetas, tips, técnica, videos). */
export function UserContentPage() {
  const [category, setCategory] = useState<'' | ContentCategory>('');
  const [page, setPage] = useState(1);
  const params = { page, limit: LIMIT, category: category || undefined };
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ['content', 'user', params],
    queryFn: () => contentApi.list(params),
    placeholderData: keepPreviousData,
  });

  const chip = (active: boolean) => cn('min-h-11 shrink-0 rounded-neo-button px-3 py-2.5 text-sm font-medium', active ? 'bg-neo-primary text-white' : 'bg-neo-neutral text-neo-dark hover:bg-neo-border');

  return (
    <div className="flex flex-col gap-4">
      <h1>Contenido</h1>
      <div role="group" aria-label="Categorías" className="flex gap-1 overflow-x-auto">
        <button type="button" aria-pressed={category === ''} className={chip(category === '')} onClick={() => { setCategory(''); setPage(1); }}>Todo</button>
        {Object.values(ContentCategory).map((c) => (
          <button key={c} type="button" aria-pressed={category === c} className={chip(category === c)} onClick={() => { setCategory(c); setPage(1); }}>
            {CONTENT_CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {isPending ? (
        <AppCard><SkeletonLoader lines={5} /></AppCard>
      ) : isError ? (
        <ErrorState message="No pudimos cargar el contenido." onRetry={() => void refetch()} />
      ) : data.data.length === 0 ? (
        <EmptyState icon={<BookOpen className="size-8" aria-hidden="true" />} title="Aún no hay contenido" description={category ? 'No hay contenido en esta categoría todavía.' : 'Tu Coach publicará recetas, tips y videos aquí.'} />
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : undefined}>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.data.map((c) => (
              <li key={c.id}>
                <Link to={userRoutes.contentItem(c.id)} className="block overflow-hidden rounded-neo-card border border-neo-border bg-neo-surface shadow-neo-card hover:border-neo-primary">
                  <ContentThumb item={c} />
                  <div className="flex flex-col gap-1 p-4">
                    <div className="flex items-center gap-2">
                      <AppBadge tone="info">{CONTENT_CATEGORY_LABEL[c.category]}</AppBadge>
                      <span className="text-xs text-neo-muted">{CONTENT_TYPE_LABEL[c.type]}</span>
                    </div>
                    <h3 className="text-base">{c.title}</h3>
                    {c.description && <p className="line-clamp-2 text-sm text-neo-muted">{c.description}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <nav aria-label="Paginación" className="mt-4 flex items-center justify-between text-sm">
            <span className="text-neo-muted">Página {data.meta.page} de {data.meta.totalPages}</span>
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
