import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppButton } from './AppButton';
import { AppInput } from './AppInput';
import { ProgressBar } from './ProgressBar';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

describe('componentes base', () => {
  it('AppButton se deshabilita mientras carga', () => {
    render(<AppButton loading>Guardar</AppButton>);
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
  });

  it('AppInput asocia etiqueta y error', () => {
    render(<AppInput label="Correo" error="Correo inválido" />);
    const input = screen.getByLabelText('Correo');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Correo inválido');
  });

  it('ProgressBar limita el valor al máximo y expone aria', () => {
    render(<ProgressBar value={7} max={5} label="Meta semanal" />);
    expect(screen.getByRole('progressbar', { name: 'Meta semanal' })).toHaveAttribute('aria-valuenow', '5');
  });

  it('EmptyState muestra la acción recomendada', () => {
    render(<EmptyState title="Sin usuarias" action={<button>Crear usuaria</button>} />);
    expect(screen.getByRole('button', { name: 'Crear usuaria' })).toBeInTheDocument();
  });

  it('ErrorState permite reintentar', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
