import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { MESSAGE_MAX_LENGTH } from '@neo/validation';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { cn } from '@/utils/cn';
import { formatDateTime } from '@/utils/format';
import { THREAD_POLL_MS, type ThreadApi } from './messagesApi';

/** Hilo de mensajes: lista cronológica, "ver anteriores", lectura automática y redacción. El texto se muestra siempre como texto plano. */
export function ThreadView({ api, emptyHint }: { api: ThreadApi; emptyHint: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const info = useQuery({ queryKey: [...api.key, 'info'], queryFn: api.info });
  const thread = useInfiniteQuery({
    queryKey: [...api.key, 'list'],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.list(pageParam),
    getNextPageParam: (last) => (last.meta.hasMore ? last.data[0]?.id : undefined),
    refetchInterval: THREAD_POLL_MS,
  });

  const messages = useMemo(() => [...(thread.data?.pages ?? [])].reverse().flatMap((p) => p.data), [thread.data]);
  const hasUnreadIncoming = messages.some((m) => !m.mine && m.readAt === null);
  const lastId = messages[messages.length - 1]?.id;
  const lastMineId = [...messages].reverse().find((m) => m.mine)?.id;

  const markRead = useMutation({
    mutationFn: api.markRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...api.key, 'list'] });
      void qc.invalidateQueries({ queryKey: ['messages', 'unread'] });
      void qc.invalidateQueries({ queryKey: ['messages', 'conversations'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  useEffect(() => {
    if (hasUnreadIncoming && !markRead.isPending) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnreadIncoming, lastId]);

  // Baja al final cuando llega o se envía un mensaje (no al cargar mensajes antiguos).
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [lastId]);

  const send = useMutation({
    mutationFn: (body: string) => api.send(body),
    onSuccess: () => {
      setDraft('');
      void qc.invalidateQueries({ queryKey: [...api.key, 'list'] });
      void qc.invalidateQueries({ queryKey: ['messages', 'conversations'] });
    },
  });

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MESSAGE_MAX_LENGTH && !send.isPending;
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (canSend) send.mutate(trimmed);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) submit();
    if (e.key === 'Enter' && !e.shiftKey) e.preventDefault();
  };

  return (
    <div className="flex h-full min-h-[24rem] flex-col">
      <div className="border-b border-neo-border pb-3">
        <h2 className="text-lg font-semibold">{info.data?.partnerName ?? 'Conversación'}</h2>
      </div>

      <div className="flex-1 overflow-y-auto py-3" role="log" aria-live="polite" aria-label="Mensajes">
        {thread.isPending ? (
          <SkeletonLoader lines={5} />
        ) : thread.error ? (
          <ErrorState message="No pudimos cargar los mensajes." onRetry={() => void thread.refetch()} />
        ) : messages.length === 0 ? (
          <EmptyState title="Aún no hay mensajes" description={emptyHint} />
        ) : (
          <>
            {thread.hasNextPage && (
              <div className="mb-3 text-center">
                <AppButton variant="ghost" loading={thread.isFetchingNextPage} onClick={() => void thread.fetchNextPage()}>Ver mensajes anteriores</AppButton>
              </div>
            )}
            <ul className="flex flex-col gap-2">
              {messages.map((m) => (
                <li key={m.id} className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')}>
                  <p className={cn('max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm', m.mine ? 'bg-neo-primary text-white' : 'bg-neo-neutral text-neo-dark')}>{m.body}</p>
                  <span className="mt-0.5 text-[11px] text-neo-muted">
                    {formatDateTime(m.createdAt)}
                    {m.id === lastMineId && (m.readAt ? ' · Leído' : ' · Enviado')}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-neo-border pt-3">
        <label htmlFor="message-draft" className="sr-only">Escribe un mensaje</label>
        <div className="flex items-end gap-2">
          <textarea
            id="message-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            maxLength={MESSAGE_MAX_LENGTH + 100}
            placeholder="Escribe un mensaje…"
            className="min-h-11 flex-1 resize-none rounded-neo-input border border-neo-border bg-neo-surface px-3 py-2 text-sm"
          />
          <AppButton type="submit" disabled={!canSend} loading={send.isPending} aria-label="Enviar mensaje"><Send className="size-4" aria-hidden="true" /></AppButton>
        </div>
        <div className="mt-1 flex justify-between text-xs text-neo-muted">
          <span>Enter envía · Shift+Enter hace un salto de línea</span>
          <span className={cn(trimmed.length > MESSAGE_MAX_LENGTH && 'text-red-700')}>{trimmed.length}/{MESSAGE_MAX_LENGTH}</span>
        </div>
        {send.isError && <p role="alert" className="mt-1 text-sm text-red-700">No se pudo enviar el mensaje. Inténtalo de nuevo.</p>}
      </form>
    </div>
  );
}
