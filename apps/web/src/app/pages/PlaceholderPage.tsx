import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';

export interface PlaceholderPageProps {
  title: string;
  /** Referencia de especificación / historia que la implementará. */
  spec: string;
}

/** Pantalla provisional hasta que se implemente su historia de usuario. */
export function PlaceholderPage({ title, spec }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1>{title}</h1>
      <AppCard>
        <EmptyState title="Pantalla en construcción" description={`Se implementará según ${spec}.`} />
      </AppCard>
    </div>
  );
}
