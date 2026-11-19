/** Reproductor de YouTube sin cookies (§9.1). El ID se valida en el backend; aquí además se codifica. */
export function YouTubePlayer({ videoId, title = 'Video del entrenamiento' }: { videoId: string; title?: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-neo-card bg-black">
      <iframe
        className="h-full w-full"
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

/** Miniatura pública de YouTube (la subida de miniaturas propias llega con el almacenamiento privado, Fase 3). */
export const youtubeThumbnail = (videoId: string) => `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
