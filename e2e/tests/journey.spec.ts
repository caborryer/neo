import { test, expect, request as pwRequest } from '@playwright/test';
import { E2E } from '../playwright.config';
import { apiLogin, csrf, linkFromEmail, uiLogin, uniqueEmail } from '../support/helpers';

/** Recorrido principal (§13.3): Coach invita → usuaria activa → inicia sesión → Coach suspende → acceso bloqueado. */
test.describe.serial('Recorrido invitación → acceso', () => {
  const email = uniqueEmail('ana');
  const password = 'ClaveUsuaria123!';
  let userId = '';

  test('la Coach crea una usuaria desde la interfaz y se envía la invitación', async ({ page }) => {
    await uiLogin(page, E2E.coachEmail, E2E.coachPassword);
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto('/coach/users/create');
    await page.getByLabel('Nombre').fill('Ana');
    await page.getByLabel('Apellido').fill('Prueba');
    await page.getByLabel('Correo').fill(email);
    await page.getByRole('button', { name: 'Crear y enviar invitación' }).click();
    await expect(page).not.toHaveURL(/\/create$/);
  });

  test('la usuaria activa su cuenta con el enlace del correo', async ({ page, request }) => {
    const link = await linkFromEmail(request, email);
    await page.goto(link);
    await page.getByLabel('Nueva contraseña', { exact: true }).fill(password);
    await page.getByLabel('Confirmar contraseña').fill(password);
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByRole('status')).toContainText('cuenta está activa');
    await page.getByRole('link', { name: 'Ir a iniciar sesión' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('la usuaria inicia sesión y no puede entrar a la zona de la Coach', async ({ page }) => {
    await uiLogin(page, email, password);
    await expect(page).not.toHaveURL(/\/login/);
    await page.goto('/coach/users');
    await expect(page).not.toHaveURL(/\/coach\/users$/);
  });

  test('la Coach suspende la cuenta y la usuaria ya no puede iniciar sesión', async ({ page }) => {
    const coach = await pwRequest.newContext();
    await apiLogin(coach, E2E.coachEmail, E2E.coachPassword);
    const list = await coach.get(`${E2E.api}/coach/users`, { params: { search: email }, headers: csrf });
    userId = (await list.json()).data[0].id;
    const res = await coach.patch(`${E2E.api}/coach/users/${userId}/access`, { data: { status: 'SUSPENDED', reason: 'E2E' }, headers: csrf });
    expect(res.ok()).toBeTruthy();

    await uiLogin(page, email, password);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Tu acceso no está disponible')).toBeVisible();
  });
});
