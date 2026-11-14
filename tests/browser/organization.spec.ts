import { test, expect } from '@playwright/test';
import { configureTestAuth } from '../auth-fixture';
import { createSession } from '../../lib/auth';

configureTestAuth();

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{ name: 'escala_session', value: createSession(), url: 'http://127.0.0.1:3105', httpOnly: true, sameSite: 'Lax' }]);
  await page.goto('/');
});

test('organization groups settings into accessible tabs and keeps unsaved input', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Organização', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Organização', exact: true })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveText(['Empresa e equipes', 'Regras de jornada', 'Sindicatos e instrumentos', 'Ausências', 'Revisão do mês']);
  await expect(page.getByRole('tab', { name: 'Empresa e equipes' })).toHaveAttribute('aria-selected', 'true');
  await page.getByLabel('Atividade / setor', { exact: true }).fill('Empresa em edição');
  await page.getByRole('tab', { name: 'Regras de jornada' }).click();
  await expect(page.getByRole('button', { name: 'Salvar regras' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Configuração da empresa' })).toBeHidden();
  await page.getByRole('tab', { name: 'Empresa e equipes' }).click();
  await expect(page.getByLabel('Atividade / setor', { exact: true })).toHaveValue('Empresa em edição');
  await page.getByRole('tab', { name: 'Empresa e equipes' }).press('End');
  await expect(page.getByRole('tab', { name: 'Revisão do mês' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Revisão do mês', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Revisão do mês' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Empresa e equipes' })).toBeFocused();
  await page.getByRole('tab', { name: 'Regras de jornada' }).click();
  await page.locator('input[name=coverage]').fill('3');
  await page.getByRole('button', { name: 'Salvar regras' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('escala.workspace.v1')!).rules.coverage)).toBe(3);
  await page.screenshot({ path: testInfo.outputPath('organization-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Regras de jornada', 'Sindicatos e instrumentos', 'Ausências', 'Revisão do mês']) {
    await page.getByRole('tab', { name, exact: true }).click();
    await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('tab', { name: 'Empresa e equipes' }).click();
  await page.screenshot({ path: testInfo.outputPath('organization-mobile.png'), fullPage: true });
});

test('schedule shortcuts open the matching organization tab', async ({ page }) => {
  await page.getByRole('button', { name: 'Revisar mês', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Revisão do mês' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Escalas', exact: true }).click();
  await page.getByRole('button', { name: 'Ver regras' }).click();
  await expect(page.getByRole('tab', { name: 'Regras de jornada' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Escalas', exact: true }).click();
  await page.getByRole('button', { name: 'Configurar limites', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Regras de jornada' })).toHaveAttribute('aria-selected', 'true');
});

