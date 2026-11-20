import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdvancedStatsPage } from './AdvancedStatsPage';
import * as csv from './csv';
import { coach, json, renderWithProviders } from '@/test/utils';

const UID = '11111111-1111-4111-8111-111111111111';
const stats = (over: object = {}) => ({
  from: '2026-08-21', to: '2026-11-18', days: 90, activeUsers: 2,
  workouts: { scheduled: 10, completed: 7, partial: 1, skipped: 1, missed: 1, upcoming: 0, adherence: 70, partialRate: 10 },
  avgSessionsPerUserWeek: 0.3, mealLogs: 12, mealLogsPerWeek: 0.9, avgFeeling: 4.2, feedbackCount: 6, avgReviewHours: 5.5,
  weekly: [
    { weekStart: '2026-11-02', scheduled: 5, completed: 4, adherence: 80, mealLogs: 6 },
    { weekStart: '2026-11-09', scheduled: 5, completed: 3, adherence: 60, mealLogs: 6 },
  ],
  distribution: [{ label: '90–100%', users: 0 }, { label: '70–89%', users: 1 }, { label: '50–69%', users: 0 }, { label: 'Menos de 50%', users: 1 }, { label: 'Sin datos', users: 0 }],
  users: [
    { userId: UID, userName: 'Ana Ruiz', scheduled: 6, completed: 5, partial: 0, adherence: 83, sessionsPerWeek: 0.4, mealLogs: 8, avgFeeling: 4.5, lastWorkoutDate: '2026-11-17' },
    { userId: 'u2', userName: '=Bea Gómez', scheduled: 4, completed: 2, partial: 1, adherence: 50, sessionsPerWeek: 0.2, mealLogs: 4, avgFeeling: null, lastWorkoutDate: null },
  ],
  topWorkouts: [{ workoutId: 'w1', title: 'Full Body', scheduled: 6, completed: 5, adherence: 83 }],
  ...over,
});

function mock(handler: (path: string, q: URLSearchParams) => Response | undefined) {
  const calls: URLSearchParams[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    const path = url.pathname.replace('/api/v1', '');
    if (path === '/users/me') return json({ data: coach });
    if (path === '/notifications/unread-count') return json({ data: { count: 0 } });
    if (path === '/coach/statistics') calls.push(url.searchParams);
    const r = handler(path, url.searchParams);
    if (!r) throw new Error(`Sin mock para ${path}`);
    return r;
  });
  return calls;
}
afterEach(() => vi.restoreAllMocks());
const ok = () => mock((p) => (p === '/coach/statistics' ? json({ data: stats() }) : undefined));

describe('estadísticas avanzadas de la Coach (HU-31)', () => {
  it('muestra KPIs, gráfico, distribución, top y la tabla por usuaria', async () => {
    ok();
    renderWithProviders(<AdvancedStatsPage />, { route: '/coach/statistics' });
    expect(await screen.findByText('7 de 10 completados')).toBeInTheDocument();
    expect(screen.getByText('4,2 / 5')).toBeInTheDocument();
    expect(screen.getByText('5,5 h')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Adherencia semanal/ })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /tramo de adherencia/ })).toBeInTheDocument();
    expect(screen.getByText('Full Body')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ana Ruiz' })).toHaveAttribute('href', `/coach/users/${UID}`);
  });

  it('pide por defecto los últimos 90 días con from y to', async () => {
    const calls = ok();
    renderWithProviders(<AdvancedStatsPage />, { route: '/coach/statistics' });
    await screen.findByText('7 de 10 completados');
    const q = calls[0]!;
    expect(q.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(q.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((Date.parse(q.get('to')! + 'T00:00:00Z') - Date.parse(q.get('from')! + 'T00:00:00Z')) / 86_400_000).toBe(89);
  });

  it('cambiar el período vuelve a pedir los datos', async () => {
    const calls = ok();
    renderWithProviders(<AdvancedStatsPage />, { route: '/coach/statistics' });
    await screen.findByText('7 de 10 completados');
    await userEvent.selectOptions(screen.getByLabelText('Período'), '365');
    await waitFor(() => expect(calls.length).toBe(2));
    expect((Date.parse(calls[1]!.get('to')! + 'T00:00:00Z') - Date.parse(calls[1]!.get('from')! + 'T00:00:00Z')) / 86_400_000).toBe(364);
  });

  it('un período personalizado inválido no consulta y avisa', async () => {
    const calls = ok();
    renderWithProviders(<AdvancedStatsPage />, { route: '/coach/statistics' });
    await screen.findByText('7 de 10 completados');
    await userEvent.selectOptions(screen.getByLabelText('Período'), 'custom');
    const from = screen.getByLabelText('Desde');
    await userEvent.clear(from);
    await userEvent.type(from, '2024-01-01');
    expect(await screen.findByRole('alert')).toHaveTextContent('366 días');
    expect(calls.every((q) => q.get('from') !== '2024-01-01')).toBe(true);
  });

  it('ordena la tabla al pulsar una columna y deja sin datos al final', async () => {
    ok();
    renderWithProviders(<AdvancedStatsPage />, { route: '/coach/statistics' });
    await screen.findByText('7 de 10 completados');
    const bodyRows = () => within(screen.getByRole('table', { name: 'Comparación por usuaria' })).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0]!.textContent);
    expect(bodyRows()).toEqual(['=Bea Gómez', 'Ana Ruiz']); // adherencia ascendente por defecto
    await userEvent.click(screen.getByRole('button', { name: /Sensación/ }));
    expect(bodyRows()).toEqual(['Ana Ruiz', '=Bea Gómez']); // descendente; null al final
  });

  it('exporta el CSV neutralizando fórmulas', async () => {
    ok();
    const spy = vi.spyOn(csv, 'downloadCsv').mockImplementation(() => undefined);
    renderWithProviders(<AdvancedStatsPage />, { route: '/coach/statistics' });
    await screen.findByText('7 de 10 completados');
    await userEvent.click(screen.getByRole('button', { name: 'Exportar a CSV' }));
    expect(spy).toHaveBeenCalledTimes(1);
    const [filename, content] = spy.mock.calls[0]!;
    expect(filename).toBe('neotraining-estadisticas-2026-08-21_2026-11-18.csv');
    expect(content).toContain("'=Bea Gómez");
    expect(content).toContain('Ana Ruiz,6,5,0,83,0.4,8,4.5,2026-11-17');
  });

  it('sin usuarias activas muestra estado vacío y no permite exportar', async () => {
    mock((p) => (p === '/coach/statistics' ? json({ data: stats({ activeUsers: 0, users: [] }) }) : undefined));
    renderWithProviders(<AdvancedStatsPage />, { route: '/coach/statistics' });
    expect(await screen.findByText('Aún no hay usuarias activas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exportar a CSV' })).toBeDisabled();
  });

  it('error de carga con reintento', async () => {
    mock((p) => (p === '/coach/statistics' ? json({ statusCode: 500, message: 'x', error: 'e' }, 500) : undefined));
    renderWithProviders(<AdvancedStatsPage />, { route: '/coach/statistics' });
    expect(await screen.findByText('No pudimos cargar las estadísticas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
