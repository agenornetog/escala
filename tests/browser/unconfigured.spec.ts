import { test, expect } from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:3106'});
test('unconfigured hosting keeps the password field usable and does not create a session',async({page})=>{
 await page.goto('/login');
 await expect(page.getByRole('status')).toContainText('ainda não foi configurado');
 await expect(page.getByLabel('E-mail',{exact:true})).toBeEnabled();
 await expect(page.getByLabel('Senha',{exact:true})).toBeEnabled();
 await page.getByLabel('E-mail',{exact:true}).fill('admin@example.test');
 await page.getByLabel('Senha',{exact:true}).fill('test-only-password-2026');
 await page.getByRole('button',{name:'Mostrar senha'}).click();
 await expect(page.getByLabel('Senha',{exact:true})).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'Entrar na minha conta'}).click();
 await expect(page.locator('.form-errors[role=alert]')).toContainText('acesso ainda não foi liberado');
 expect((await page.context().cookies()).some(c=>c.name==='escala_session')).toBe(false);
 await page.goto('/');await expect(page).toHaveURL(/\/login$/);
});
