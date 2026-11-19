import { test, expect, request as pwRequest } from '@playwright/test';
import { E2E } from '../playwright.config';
import { csrf } from '../support/helpers';

test.describe('Seguridad básica', () => {
  test('una ruta privada sin sesión redirige al login', async ({ page }) => {
    await page.goto('/coach/users');
    await expect(page).toHaveURL(/\/login/);
  });

  test('la API rechaza peticiones sin sesión', async () => {
    const api = await pwRequest.newContext();
    const res = await api.get(`${E2E.api}/coach/users`, { headers: csrf });
    expect(res.status()).toBe(401);
  });

  test('la API exige la cabecera anti-CSRF en peticiones que modifican datos', async () => {
    const api = await pwRequest.newContext();
    const res = await api.post(`${E2E.api}/auth/login`, { data: { email: E2E.coachEmail, password: E2E.coachPassword } });
    expect(res.status()).toBe(403);
  });

  test('credenciales incorrectas muestran un error genérico', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo').fill(E2E.coachEmail);
    await page.getByLabel('Contraseña').fill('incorrecta-123');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText('Correo o contraseña incorrectos')).toBeVisible();
  });

  test('la respuesta incluye cabeceras de seguridad y cookies HttpOnly', async () => {
    const api = await pwRequest.newContext();
    const res = await api.post(`${E2E.api}/auth/login`, { data: { email: E2E.coachEmail, password: E2E.coachPassword }, headers: csrf });
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['set-cookie']).toMatch(/HttpOnly/i);
  });
});
