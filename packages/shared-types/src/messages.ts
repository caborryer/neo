/** Mensajería individual (HU-32 · C09). Un hilo por usuaria; la contraparte es su Coach. */

export interface MessageDto {
  id: string;
  body: string;
  /** Lo escribió quien consulta (no depende del rol). */
  mine: boolean;
  createdAt: string;
  /** Cuándo lo leyó la contraparte; null si aún no. Solo es relevante en los mensajes propios. */
  readAt: string | null;
}

export interface MessageListDto {
  /** Del más antiguo al más reciente. */
  data: MessageDto[];
  meta: { hasMore: boolean };
}

export interface ConversationDto {
  userId: string;
  userName: string;
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
  unread: number;
}

export interface ThreadInfoDto {
  /** Nombre de la contraparte para el encabezado (la Coach para la usuaria; la usuaria para la Coach). */
  partnerName: string;
}
