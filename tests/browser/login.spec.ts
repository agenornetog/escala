import { test, expect } from '@playwright/test';
import { testEmail, testPassword } from '../auth-fixture';
test('anonymous access redirects to login and the API returns 401',async({page})=>{
 await page.goto('/');await expect(page).toHaveURL(/\/login$/);
 await expect(page.getByRole('heading',{name:'Bom ter você por aqui.'})).toBeVisible();
 const response=await page.request.post('/api/validate',{data:{}});expect(response.status()).toBe(401);
});
test('login supports password visibility, invalid credentials, session persistence and logout',async({page})=>{
 await page.goto('/login');
 await page.getByLabel('E-mail',{exact:true}).fill(testEmail);
 await page.getByLabel('Senha',{exact:true}).fill('incorrect');
 await page.getByRole('button',{name:'Mostrar senha'}).click();
 await expect(page.getByLabel('Senha',{exact:true})).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'Ocultar senha'}).click();
 await page.getByRole('button',{name:'Entrar na minha conta'}).click();
 await expect(page.locator('.form-errors[role=alert]')).toContainText('E-mail ou senha incorretos');
 await page.getByLabel('Senha',{exact:true}).fill(testPassword);
 await page.getByRole('button',{name:'Entrar na minha conta'}).click();
 await expect(page.getByRole('heading',{name:'Sua equipe, no ritmo certo.'})).toBeVisible();
 const cookie=(await page.context().cookies()).find(c=>c.name==='escala_session');expect(cookie?.httpOnly).toBe(true);
 await page.reload();await expect(page.getByRole('heading',{name:'Sua equipe, no ritmo certo.'})).toBeVisible();
 await page.goto('/login');await expect(page).toHaveURL('http://127.0.0.1:3105/');
 await page.getByRole('button',{name:'Sair da conta'}).click();await expect(page).toHaveURL(/\/login$/);
 await page.goto('/');await expect(page).toHaveURL(/\/login$/);
});
test('login works on mobile and desktop without overflow',async({page})=>{
 await page.goto('/login');
 for(const width of [360,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(page.getByRole('button',{name:'Entrar na minha conta'})).toBeVisible();
  if(width===390||width===1440)await page.screenshot({path:`/tmp/escala-login-${width}.png`,fullPage:true});
 }
});
