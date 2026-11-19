import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppCard } from '@/components/ui/AppCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { YouTubePlayer } from '@/features/workouts/YouTubePlayer';
import { ApiError } from '@/services/apiClient';
import { userRoutes } from '@/app/routes';
import { contentApi } from './contentApi';
import { CONTENT_CATEGORY_LABEL } from './labels';

export function ContentDetailPage() {
  const { id } = useParams();
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['content-item', id], queryFn: () => contentApi.get(id!), enabled: !!id });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link to={userRoutes.content} className="inline-flex items-center gap-1 text-sm font-medium text-neo-primary-dark hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> Contenido
      </Link>
      {isPending ? (
        <AppCard><SkeletonLoader lines={6} /></AppCard>
      ) : error ? (
        error instanceof ApiError && error.statusCode === 404 ? <ErrorState message="No encontramos ese contenido." /> : <ErrorState message="No pudimos cargar el contenido." onRetry={() => void refetch()} />
      ) : (
        <article className="flex flex-col gap-4">
          <div>
            <AppBadge tone="info">{CONTENT_CATEGORY_LABEL[data.category]}</AppBadge>
            <h1 className="mt-2">{data.title}</h1>
            {data.description && <p className="mt-1 text-neo-muted">{data.description}</p>}
          </div>
          {data.type === 'VIDEO' && data.videoId && <YouTubePlayer videoId={data.videoId} title={data.title} />}
          {data.type === 'ARTICLE' && data.thumbnailUrl && <img src={data.thumbnailUrl} alt="" className="aspect-video w-full rounded-neo-card object-cover" />}
          {data.type === 'ARTICLE' && data.body && <AppCard><div className="whitespace-pre-line leading-relaxed">{data.body}</div></AppCard>}
        </article>
      )}
    </div>
  );
}
