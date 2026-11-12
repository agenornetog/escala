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
test('login shows the white brand over the schedule on mobile and desktop',async({page},testInfo)=>{
 await page.goto('/login');
 const brand=page.getByRole('link',{name:'escalô — início'});
 const hero=page.locator('.login-hero');
 const schedule=page.locator('.login-preview');
 const form=page.locator('.login-card');
 for(const width of [360,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await expect(brand).toBeVisible();
  await expect(brand).toHaveCSS('color','rgb(255, 255, 255)');
  await expect(schedule).toBeVisible();
  const brandBox=(await brand.boundingBox())!;
  const formBox=(await form.boundingBox())!;
  const heroBox=(await hero.boundingBox())!;
  const scheduleBox=(await schedule.boundingBox())!;
  expect(scheduleBox.x).toBeGreaterThan(heroBox.x);
  expect(scheduleBox.x+scheduleBox.width).toBeLessThan(heroBox.x+heroBox.width);
  expect(scheduleBox.y).toBeGreaterThan(heroBox.y);
  expect(scheduleBox.y+scheduleBox.height).toBeLessThan(heroBox.y+heroBox.height);
  if(width>720) expect(heroBox.height).toBeGreaterThanOrEqual(1000);
  expect(width>720?brandBox.x<formBox.x:brandBox.y<formBox.y).toBe(true);
  await expect(page.getByRole('button',{name:'Entrar na minha conta'})).toBeVisible();
  if(width===390||width===1440)await page.screenshot({path:testInfo.outputPath(`escala-login-${width}.png`),fullPage:true});
 }
});
