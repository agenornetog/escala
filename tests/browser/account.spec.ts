import { test, expect } from '@playwright/test';
import { configureTestAuth } from '../auth-fixture';
import { createSession } from '../../lib/auth';

configureTestAuth();

test('account shows real identity, persists name and photo, removes photo and validates password changes', async ({ context, page }, testInfo) => {
  await context.addCookies([{ name: 'escala_session', value: createSession(), url: 'http://127.0.0.1:3105', httpOnly: true, sameSite: 'Lax' }]);
  let profile = { name: 'Maria Silva', email: 'maria@example.test', role: 'Gestor', avatarUrl: null as string | null, editable: true };
  let photo = Buffer.alloc(0);
  let passwordRequests = 0;
  await page.route('**/api/account**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/password')) {
      passwordRequests++;
      const body = request.postDataJSON();
      if (body.currentPassword !== 'current-password-2026') return route.fulfill({ status: 400, json: { error: 'Confira a senha atual.' } });
      expect(body.password).toBe('new-password-2026');
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith('/avatar')) {
      if (request.method() === 'GET') return route.fulfill({ contentType: 'image/png', body: photo });
      if (request.method() === 'POST') {
        expect(request.headers()['content-type']).toBe('image/webp');
        expect(request.postDataBuffer()!.subarray(0, 4).toString()).toBe('RIFF');
        profile = { ...profile, avatarUrl: '/api/account/avatar?v=photo' };
      } else profile = { ...profile, avatarUrl: null };
      return route.fulfill({ json: profile });
    }
    if (request.method() === 'PATCH') profile = { ...profile, name: request.postDataJSON().name };
    return route.fulfill({ json: profile });
  });
  await page.goto('/');
  const account = page.getByRole('button', { name: 'Minha conta', exact: true });
  await expect(account).toContainText('Maria Silva');
  await expect(account).toContainText('Gestor');
  await account.click();
  const dialog = page.getByRole('dialog', { name: 'Minha conta', exact: true });
  await expect(dialog.getByLabel('E-mail', { exact: true })).toHaveValue('maria@example.test');
  await dialog.getByLabel('Nome', { exact: true }).fill('Maria Souza');
  await dialog.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
  await expect(account).toContainText('Maria Souza');
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; canvas.getContext('2d')!.fillRect(0, 0, 32, 32); return canvas.toDataURL('image/png').split(',')[1]; });
  photo = Buffer.from(png, 'base64');
  await dialog.getByLabel('Escolher foto', { exact: true }).setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: photo });
  await expect(dialog.getByRole('status')).toHaveText('Foto atualizada.');
  await expect(account.locator('img')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('account-desktop.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.reload();
  await expect(account).toContainText('Maria Souza');
  await expect(account.locator('img')).toBeVisible();
  await account.click();
  await dialog.getByRole('button', { name: 'Remover foto', exact: true }).click();
  await expect(account.locator('img')).toHaveCount(0);
  await dialog.getByLabel('Senha atual', { exact: true }).fill('wrong-password-2026');
  await dialog.getByLabel('Nova senha', { exact: true }).fill('new-password-2026');
  await dialog.getByLabel('Confirme a nova senha', { exact: true }).fill('different-password-2026');
  await dialog.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('As novas senhas precisam ser iguais.');
  expect(passwordRequests).toBe(0);
  await dialog.getByLabel('Confirme a nova senha', { exact: true }).fill('new-password-2026');
  await dialog.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Confira a senha atual.');
  await dialog.getByLabel('Senha atual', { exact: true }).fill('current-password-2026');
  await dialog.getByRole('button', { name: 'Salvar nova senha', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Senha atualizada.');
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await account.click();
  await expect(page.getByRole('dialog', { name: 'Menu de navegação' })).toHaveCount(0);
  await expect(dialog.getByLabel('Nome', { exact: true })).toHaveValue('Maria Souza');
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('account-mobile.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('legacy local account keeps its signed identity and explains company sign-in for editing', async ({ context, page }) => {
  await context.addCookies([{ name: 'escala_session', value: createSession(), url: 'http://127.0.0.1:3105', httpOnly: true, sameSite: 'Lax' }]);
  await page.goto('/');
  const account = page.getByRole('button', { name: 'Minha conta', exact: true });
  await expect(account).toContainText('admin@example.test');
  await account.click();
  const dialog = page.getByRole('dialog', { name: 'Minha conta', exact: true });
  await expect(dialog).toContainText('Entre com sua conta da empresa');
  await expect(dialog.getByRole('button', { name: 'Salvar perfil' })).toHaveCount(0);
});

test('account can retry an initial service failure without reloading the schedule', async ({ context, page }) => {
  await context.addCookies([{ name: 'escala_session', value: createSession(), url: 'http://127.0.0.1:3105', httpOnly: true, sameSite: 'Lax' }]);
  let attempts = 0;
  await page.route('**/api/account', route => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, json: { error: 'Serviço temporariamente indisponível.' } })
      : route.fulfill({ json: { name: 'Perfil recuperado', email: 'pessoa@example.test', role: 'Gestor', avatarUrl: null, editable: true } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Minha conta', exact: true });
  await expect(dialog.getByRole('alert')).toHaveText('Serviço temporariamente indisponível.');
  await dialog.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(dialog.getByLabel('Nome', { exact: true })).toHaveValue('Perfil recuperado');
});
