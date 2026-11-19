import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNavigation } from './BottomNavigation';
import { Sidebar } from './Sidebar';

describe('navegación', () => {
  it('la usuaria ve las 5 secciones y Retos aparece deshabilitado', () => {
    render(
      <MemoryRouter>
        <BottomNavigation />
      </MemoryRouter>,
    );
    for (const label of ['Inicio', 'Entrenamientos', 'Nutrición', 'Retos', 'Perfil']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Retos').closest('[aria-disabled="true"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Inicio/ })).toHaveAttribute('href', '/app/dashboard');
  });

  it('la Coach ve los módulos del MVP como enlaces', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Usuarias/ })).toHaveAttribute('href', '/coach/users');
    expect(screen.getByRole('link', { name: /Planes nutricionales/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Estadísticas/ })).toBeNull();
  });
});
