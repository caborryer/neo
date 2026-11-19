import { BookOpen } from 'lucide-react';
import type { ContentDto } from '@neo/shared-types';
import { youtubeThumbnail } from '@/features/workouts/YouTubePlayer';

/** Imagen de una tarjeta: la miniatura subida, la de YouTube si es un video, o un marcador. */
export function ContentThumb({ item }: { item: Pick<ContentDto, 'thumbnailUrl' | 'videoId' | 'type'> }) {
  const src = item.thumbnailUrl ?? (item.type === 'VIDEO' && item.videoId ? youtubeThumbnail(item.videoId) : null);
  return src ? (
    <img src={src} alt="" loading="lazy" className="aspect-video w-full bg-neo-neutral object-cover" />
  ) : (
    <div className="flex aspect-video w-full items-center justify-center bg-neo-pink-light text-neo-primary-dark">
      <BookOpen className="size-8" aria-hidden="true" />
    </div>
  );
}
