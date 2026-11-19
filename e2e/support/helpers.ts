import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { E2E } from '../playwright.config';

export const csrf = { 'X-Requested-With': 'neo-web' };

export async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${E2E.api}/auth/login`, { data: { email, password }, headers: csrf });
  expect(res.ok(), `login API de ${email}`).toBeTruthy();
}

export async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

/** Busca en Mailpit el enlace del último correo enviado a `to`. */
export async function linkFromEmail(request: APIRequestContext, to: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const list = await request.get(`${E2E.mailpit}/api/v1/search`, { params: { query: `to:${to}` } });
    const msgs = (await list.json()).messages as { ID: string }[];
    if (msgs?.length) {
      const msg = await (await request.get(`${E2E.mailpit}/api/v1/message/${msgs[0].ID}`)).json();
      const m = /https?:\/\/[^\s"'<>]*reset-password\?[^\s"'<>]*/.exec(`${msg.Text} ${msg.HTML}`);
      if (m) return m[0].replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No llegó el correo a ${to}`);
}

export const uniqueEmail = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@e2e.neo.local`;
