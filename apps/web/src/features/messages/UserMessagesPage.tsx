import { AppCard } from '@/components/ui/AppCard';
import { userThread } from './messagesApi';
import { ThreadView } from './ThreadView';

/** HU-32: la usuaria conversa con su Coach. */
export function UserMessagesPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1>Mensajes</h1>
      <AppCard className="h-[70vh]">
        <ThreadView api={userThread} emptyHint="Escríbele a tu Coach cuando necesites ayuda." />
      </AppCard>
    </div>
  );
}
