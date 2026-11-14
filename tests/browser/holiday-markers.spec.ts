import { test, expect } from '@playwright/test';
import { configureTestAuth } from '../auth-fixture';
import { createSession } from '../../lib/auth';
import { today } from '../../lib/dates';

configureTestAuth();

test('applied holidays have visible labels in registry and both schedule orientations', async ({ context, page }, testInfo) => {
  await context.addCookies([{ name: 'escala_session', value: createSession(), url: 'http://127.0.0.1:3105', httpOnly: true, sameSite: 'Lax' }]);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sua equipe, no ritmo certo.' })).toBeVisible();
  const date = today();
  await page.evaluate(date => {
    const store = JSON.parse(localStorage.getItem('escala.workspace.v1')!);
    store.workspaceLocation = { state: 'RN', city: 'Mossoró' };
    store.holidays = [
      { id: 'national', name: 'Feriado nacional de teste', date, scope: 'nacional', annual: false },
      { id: 'city', name: 'Feriado municipal de teste', date, scope: 'municipal', state: 'RN', city: 'Mossoró', annual: false },
      { id: 'other', name: 'Feriado de outra localidade', date, scope: 'estadual', state: 'SP', annual: false },
    ];
    localStorage.setItem('escala.workspace.v1', JSON.stringify(store));
  }, date);
  await page.reload();
  const marker = page.locator('.schedule-table .holiday-marker');
  await expect(marker).toHaveCount(1);
  await expect(marker).toHaveText('Feriado');
  await expect(marker).toHaveAttribute('title', 'Feriado nacional de teste; Feriado municipal de teste');
  await expect(marker.locator('svg')).toBeVisible();
  await page.getByRole('button', { name: 'Por data', exact: true }).click();
  await expect(page.locator('tbody .holiday-marker')).toHaveText('Feriado');
  await expect(page.locator('tbody .holiday-marker')).toBeVisible();
  await page.locator('tbody .holiday-marker').scrollIntoViewIfNeeded();
  await page.locator('.schedule-card').screenshot({ path: testInfo.outputPath('holiday-agenda.png') });
  await page.getByRole('button', { name: 'Mês', exact: true }).click();
  await expect(page.locator('tbody .holiday-marker')).toBeVisible();
  await page.getByRole('button', { name: 'Por colaborador', exact: true }).click();
  await expect(page.locator('thead .holiday-marker')).toBeVisible();
  await page.getByRole('button', { name: 'Feriados', exact: true }).click();
  const national = page.locator('.holiday-table tbody tr').filter({ hasText: 'Feriado nacional de teste' });
  const municipal = page.locator('.holiday-table tbody tr').filter({ hasText: 'Feriado municipal de teste' });
  const other = page.locator('.holiday-table tbody tr').filter({ hasText: 'Feriado de outra localidade' });
  await expect(national.getByText('Aplicado', { exact: true })).toBeVisible();
  await expect(municipal.getByText('Aplicado', { exact: true })).toBeVisible();
  await expect(other.getByText('Aplicado', { exact: true })).toHaveCount(0);
  await expect(other.getByText('Fora da localidade atual')).toBeVisible();
  await page.locator('.holiday-panel').screenshot({ path: testInfo.outputPath('holiday-list.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});



