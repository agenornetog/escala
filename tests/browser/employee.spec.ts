import {test,expect,type Page} from '@playwright/test';
import {testEmail,testPassword} from '../auth-fixture';
import {addMonths,today} from '../../lib/dates';
test.use({baseURL:'http://127.0.0.1:3108'});
const base='http://127.0.0.1:3108',password='employee-browser-password-2026';
async function login(page:Page,email:string,pass:string){await page.goto(base+'/login');await page.getByLabel('E-mail',{exact:true}).fill(email);await page.getByLabel('Senha',{exact:true}).fill(pass);await page.getByRole('button',{name:'Entrar na minha conta'}).click();}
async function access(page:Page){await page.getByRole('button',{name:'Colaboradores',exact:true}).click();await page.getByRole('button',{name:'Gerenciar acesso de Ana Costa',exact:true}).click();await expect(page.getByLabel('E-mail de acesso')).toBeVisible();}
test('admin publishes access; collaborator sees only own month and cannot reach manager endpoints',async({page,browser},testInfo)=>{
 await login(page,testEmail,testPassword);await expect(page.getByRole('heading',{name:'Sua equipe, no ritmo certo.'})).toBeVisible();await access(page);
 await page.getByLabel('E-mail de acesso').fill('ana-browser@example.test');
 await page.locator('input[name=password]').fill(password);
 await page.getByRole('button',{name:'Salvar acesso e publicar jornada'}).click();await expect(page.getByRole('status')).toContainText('jornada publicada');
 await page.screenshot({path:testInfo.outputPath('acesso-colaborador.png'),fullPage:true});
 const context=await browser.newContext(),employee=await context.newPage();
 try{
  await login(employee,'ana-browser@example.test',password);await expect(employee).toHaveURL(base+'/colaborador');
  await expect(employee.getByRole('heading',{name:'Minha jornada.'})).toBeVisible();
  const navigation=employee.getByRole('navigation',{name:'Navegação principal'});
  await expect(navigation.getByRole('button',{name:'Escalas'})).toHaveAttribute('aria-current','page');
  await expect(navigation.getByRole('button')).toHaveCount(1);
  await expect(employee.locator('.page-heading')).toContainText('Ana Costa');await expect(employee.locator('body')).not.toContainText('Bruno Almeida');
  await expect(employee.getByRole('button',{name:'Novo turno'})).toHaveCount(0);await expect(employee.locator('.employee-day')).toHaveCount(new Date(Number(today().slice(0,4)),Number(today().slice(5,7)),0).getDate());
  const own=await employee.request.get(base+'/api/employee/me?month='+today().slice(0,7)+'&employeeId=other');expect(own.status()).toBe(200);expect((await own.json()).employee.name).toBe('Ana Costa');
  expect((await employee.request.get(base+'/api/admin/employee-access?employeeId=other')).status()).toBe(403);
  expect((await employee.request.post(base+'/api/validate',{data:{}})).status()).toBe(403);
  expect((await employee.request.put(base+'/api/employee/me',{data:{}})).status()).toBe(405);
  await employee.goto(base+'/');await expect(employee).toHaveURL(base+'/colaborador');
  for(const width of [390,1440]){await employee.setViewportSize({width,height:900});expect(await employee.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await employee.screenshot({path:testInfo.outputPath(`minha-jornada-${width}.png`),fullPage:true});}
  await employee.setViewportSize({width:390,height:900});
  await employee.getByRole('button',{name:'Abrir menu'}).click();
  await expect(navigation.getByRole('button',{name:'Escalas'})).toBeVisible();
  await navigation.getByRole('button',{name:'Escalas'}).click();
  await expect(employee.getByRole('button',{name:'Abrir menu'})).toHaveAttribute('aria-expanded','false');
  await employee.getByRole('button',{name:'Próximo mês',exact:true}).click();
  await expect(employee.getByText('Carregando planejamento…')).toHaveCount(0);await expect(employee.locator('.employee-day.working')).toHaveCount(0);
  await page.getByLabel('Permitir acesso à jornada').uncheck();await page.getByRole('button',{name:'Salvar acesso e publicar jornada'}).click();await expect(page.getByRole('status')).toContainText('desativado');
  expect((await employee.request.get(base+'/api/employee/me')).status()).toBe(401);await employee.reload();await expect(employee).toHaveURL(base+'/login');
 }finally{await context.close();}
});
test('publication updates own folgas, blank password preserves login, password reset revokes session',async({page,browser})=>{
 await login(page,testEmail,testPassword);await expect(page.getByRole('heading',{name:'Sua equipe, no ritmo certo.'})).toBeVisible();
 const month=addMonths(today().slice(0,7),1);
 await page.evaluate(({month})=>{const store=JSON.parse(localStorage.getItem('escala.workspace.v1')!);const person=store.employees.find((e:{name:string})=>e.name==='Ana Costa');store.dayOffs=[{id:'published-off',employeeId:person.id,date:month+'-02'}];store.shifts.push({id:'published-turn',employeeId:person.id,date:month+'-03',start:'08:00',end:'17:00',breakMinutes:60});localStorage.setItem('escala.workspace.v1',JSON.stringify(store));},{month});
 await page.reload();await access(page);await page.getByLabel('E-mail de acesso').fill('ana-update@example.test');await page.locator('input[name=password]').fill(password);await page.getByLabel('Permitir acesso à jornada').check();await page.getByRole('button',{name:'Salvar acesso e publicar jornada'}).click();await expect(page.getByRole('status')).toContainText('jornada publicada');
 const context=await browser.newContext(),employee=await context.newPage();
 try{
  await login(employee,'ana-update@example.test',password);await expect(employee.getByRole('heading',{name:'Minha jornada.'})).toBeVisible();await employee.getByRole('button',{name:'Próximo mês',exact:true}).click();
  await expect(employee.locator('.employee-day.off')).toHaveCount(1);await expect(employee.locator('.employee-day.working')).toHaveCount(1);await expect(employee.locator('.employee-day.working')).toContainText('08:00-17:00');
  await page.getByRole('button',{name:'Salvar acesso e publicar jornada'}).click();await expect(page.getByRole('status')).toContainText('jornada publicada');expect((await employee.request.get(base+'/api/employee/me')).status()).toBe(200);
  await page.locator('input[name=password]').fill('changed-browser-password-2026');await page.getByRole('button',{name:'Salvar acesso e publicar jornada'}).click();await expect(page.getByRole('status')).toContainText('jornada publicada');expect((await employee.request.get(base+'/api/employee/me')).status()).toBe(401);
  await employee.getByRole('button',{name:'Sair da conta',exact:true}).click();await expect(employee).toHaveURL(base+'/login');await employee.getByLabel('E-mail',{exact:true}).fill('ana-update@example.test');await employee.getByLabel('Senha',{exact:true}).fill(password);await employee.getByRole('button',{name:'Entrar na minha conta'}).click();await expect(employee.locator('.form-errors[role=alert]')).toContainText('incorretos');
  await employee.getByLabel('Senha',{exact:true}).fill('changed-browser-password-2026');await employee.getByRole('button',{name:'Entrar na minha conta'}).click();await expect(employee.getByRole('heading',{name:'Minha jornada.'})).toBeVisible();
 }finally{await context.close();}
});
test('access configuration explains missing database without inventing credentials',async({page})=>{
 await page.goto('http://127.0.0.1:3105/login');await page.getByLabel('E-mail',{exact:true}).fill(testEmail);await page.getByLabel('Senha',{exact:true}).fill(testPassword);await page.getByRole('button',{name:'Entrar na minha conta'}).click();await expect(page.getByRole('heading',{name:'Sua equipe, no ritmo certo.'})).toBeVisible();await page.getByRole('button',{name:'Colaboradores',exact:true}).click();await page.getByRole('button',{name:'Gerenciar acesso de Ana Costa',exact:true}).click();await expect(page.locator('.form-errors[role=alert]')).toContainText('armazenamento compartilhado ainda não foi ativado');await expect(page.getByLabel('E-mail de acesso')).toHaveCount(0);
});
