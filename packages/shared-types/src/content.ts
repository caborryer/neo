import type { ChallengeGoalUnit, ChallengeParticipantStatus, ContentCategory, ContentType } from './enums';

/** Contenido educativo (HU-33). Fuente: docs/ESPECIFICACION.md C04. */
export interface ContentDto {
  id: string;
  title: string;
  description: string | null;
  category: ContentCategory;
  type: ContentType;
  /** Texto del artículo (type ARTICLE). */
  body: string | null;
  /** ID de YouTube (type VIDEO). */
  videoId: string | null;
  thumbnailUrl: string | null;
  thumbnailAssetId: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ChallengePhase = 'UPCOMING' | 'ACTIVE' | 'ENDED';

export interface ChallengeParticipationDto {
  status: ChallengeParticipantStatus;
  progress: number;
  joinedAt: string;
}

/** Reto (HU-29/30). `published` equivale a `isActive` del modelo. */
export interface ChallengeDto {
  id: string;
  name: string;
  description: string | null;
  category: string;
  goal: number;
  goalUnit: ChallengeGoalUnit;
  startDate: string;
  endDate: string;
  published: boolean;
  phase: ChallengePhase;
  participantCount: number;
  createdAt: string;
  /** Participación de la usuaria que consulta; null si no está inscrita. Solo en vistas de usuaria. */
  my: ChallengeParticipationDto | null;
}

export interface ChallengeParticipantRow {
  userId: string;
  name: string;
  status: ChallengeParticipantStatus;
  progress: number;
  joinedAt: string;
}

export interface ChallengeDetailDto extends ChallengeDto {
  participants: ChallengeParticipantRow[];
}

export interface ChallengeActivityDto {
  sessionId: string;
  workoutTitle: string;
  completedAt: string;
}

export interface ChallengeProgressDto {
  challengeId: string;
  goal: number;
  progress: number;
  status: ChallengeParticipantStatus;
  joinedAt: string;
  activities: ChallengeActivityDto[];
}
