import { AlertTriangle } from 'lucide-react';
import { AppButton } from './AppButton';

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = 'Algo salió mal. Intenta de nuevo.', onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-neo-card border border-red-200 bg-red-50 p-8 text-center">
      <AlertTriangle className="size-6 text-red-700" aria-hidden="true" />
      <p className="text-sm text-red-900">{message}</p>
      {onRetry && (
        <AppButton variant="secondary" onClick={onRetry}>
          Reintentar
        </AppButton>
      )}
    </div>
  );
}
