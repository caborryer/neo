import { Link } from 'react-router-dom';
import { ChevronRight, Clock } from 'lucide-react';
import type { AssignmentDto } from '@neo/shared-types';
import { userRoutes } from '@/app/routes';
import { AssignmentStatusBadge, DIFFICULTY_LABEL } from '@/features/workouts/labels';
import { youtubeThumbnail } from '@/features/workouts/YouTubePlayer';

/** Tarjeta de entrenamiento para la usuaria (U02): miniatura, duración, nivel y estado. */
export function AssignmentCard({ assignment: a, showDate = false }: { assignment: AssignmentDto; showDate?: boolean }) {
  return (
    <Link
      to={userRoutes.workout(a.id)}
      className="flex items-center gap-3 rounded-neo-card border border-neo-border bg-neo-surface p-3 shadow-neo-card transition-colors hover:bg-neo-neutral"
    >
      <img src={youtubeThumbnail(a.workout.videoId)} alt="" loading="lazy" className="aspect-video w-24 shrink-0 rounded-neo-input bg-neo-neutral object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{a.workout.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-neo-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" /> {a.workout.durationMinutes} min
          </span>
          <span>{DIFFICULTY_LABEL[a.workout.difficulty]}</span>
          {showDate && <span>{a.scheduledDate}</span>}
          {a.scheduledTime && <span>{a.scheduledTime}</span>}
        </p>
        <div className="mt-1.5">
          <AssignmentStatusBadge status={a.status} scheduledDate={a.scheduledDate} />
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-neo-muted" aria-hidden="true" />
    </Link>
  );
}
