import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md p-8">
      <EmptyState
        title="Página no encontrada"
        description="La dirección no existe o ya no está disponible."
        action={<Link to="/" className="font-semibold text-neo-primary-dark underline">Volver al inicio</Link>}
      />
    </div>
  );
}
