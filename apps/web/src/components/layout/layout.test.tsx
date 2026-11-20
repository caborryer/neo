import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BottomNavigation } from './BottomNavigation';
import { Sidebar } from './Sidebar';

describe('navegación', () => {
  it('la usuaria ve las 5 secciones y Retos es un enlace', () => {
    render(
      <MemoryRouter>
        <BottomNavigation />
      </MemoryRouter>,
    );
    for (const label of ['Inicio', 'Entrenamientos', 'Nutrición', 'Retos', 'Perfil']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: /Retos/ })).toHaveAttribute('href', '/app/challenges');
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
    expect(screen.getByRole('link', { name: /Contenido/ })).toHaveAttribute('href', '/coach/content');
    expect(screen.getByRole('link', { name: /Retos/ })).toHaveAttribute('href', '/coach/challenges');
    expect(screen.getByRole('link', { name: /Estadísticas/ })).toHaveAttribute('href', '/coach/statistics');
    expect(screen.getByRole('link', { name: /Mensajes/ })).toHaveAttribute('href', '/coach/messages');
  });
});
