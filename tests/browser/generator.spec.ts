import { test, expect } from '@playwright/test';
import { testEmail, testPassword } from '../auth-fixture';
import { addMonths, today } from '../../lib/dates';
test.setTimeout(90000);
const month=addMonths(today().slice(0,7),1);
test.beforeEach(async({page})=>{
 const response=await page.request.post('/api/auth/login',{headers:{origin:'http://127.0.0.1:3105'},data:{email:testEmail,password:testPassword}});expect(response.status()).toBe(200);
 await page.goto('/');await expect(page.getByRole('heading',{name:'Sua equipe, no ritmo certo.'})).toBeVisible();
});
test('previews the month without mutation, respects individual hours, preserves manual planning and persists after apply',async({page})=>{
 await page.evaluate(({month})=>{const store=JSON.parse(localStorage.getItem('escala.workspace.v1')!);store.shifts=[{id:'fixed-shift',employeeId:store.employees[0].id,date:month+'-10',start:'08:00',end:'17:00',breakMinutes:60}];store.dayOffs=[{id:'fixed-off',employeeId:store.employees[0].id,date:month+'-11'}];store.swaps=[];store.employees[1].ruleOverrides={dailyHours:6,weeklyHours:30};localStorage.setItem('escala.workspace.v1',JSON.stringify(store));},{month});
 await page.reload();const before=await page.evaluate(()=>localStorage.getItem('escala.workspace.v1'));
 await page.getByRole('button',{name:'Gerar escala',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Gerar escala do mês'});
 await dialog.getByLabel('Mês da geração').fill(month);await dialog.getByRole('button',{name:'Gerar prévia'}).click();
 await expect(dialog.getByRole('region',{name:'Prévia da escala'})).toBeVisible({timeout:30000});await expect(dialog.getByRole('status')).toContainText('Meta de cobertura atendida');
 expect(await page.evaluate(()=>localStorage.getItem('escala.workspace.v1'))).toBe(before);
 const bruno=dialog.locator('.generator-preview tbody tr').filter({hasText:'Bruno Almeida'});await expect(bruno).toContainText('14:15');await expect(bruno).toContainText('6h/dia');
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/escala-gerador-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await dialog.getByRole('button',{name:'Aplicar escala do mês'}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/escala-gerador-mobile.png',fullPage:true});
 await dialog.getByRole('button',{name:'Aplicar escala do mês'}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('.schedule-title .pill')).toHaveText('Mensal');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('escala.workspace.v1')!));expect(saved.shifts.some((s:{id:string})=>s.id==='fixed-shift')).toBe(true);expect(saved.dayOffs.some((s:{id:string})=>s.id==='fixed-off')).toBe(true);expect(saved.shifts.length).toBeGreaterThan(80);expect(saved.shifts.filter((s:{employeeId:string;id:string})=>s.employeeId==='e2'&&s.id!=='fixed-shift').every((s:{end:string;breakMinutes:number})=>s.end==='14:15'&&s.breakMinutes===15)).toBe(true);
 await page.reload();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('escala.workspace.v1')!).shifts.length)).toBe(saved.shifts.length);
});
test('shows coverage gaps, requires explicit acceptance and invalidates the preview on configuration changes',async({page})=>{
 await page.evaluate(()=>{const store=JSON.parse(localStorage.getItem('escala.workspace.v1')!);store.employees=store.employees.slice(0,1);store.shifts=[];store.dayOffs=[];store.swaps=[];localStorage.setItem('escala.workspace.v1',JSON.stringify(store));});await page.reload();
 await page.getByRole('button',{name:'Gerar escala',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Mês da geração').fill(month);await dialog.getByRole('button',{name:'Gerar prévia'}).click();await expect(dialog.getByRole('status')).toContainText('Faltam',{timeout:30000});
 await expect(dialog.getByRole('button',{name:'Aplicar escala do mês'})).toBeDisabled();await dialog.getByLabel('Revisarei os dias com cobertura pendente',{exact:false}).check();await expect(dialog.getByRole('button',{name:'Aplicar escala do mês'})).toBeEnabled();
 await dialog.getByLabel('Meta diária para a seleção').fill('3');await expect(dialog.getByRole('region',{name:'Prévia da escala'})).toHaveCount(0);
 await dialog.getByLabel('Entrada dos turnos').fill('22:00');await dialog.getByRole('button',{name:'Gerar prévia'}).click();await expect(dialog.locator('.form-errors')).toContainText('ultrapassa meia-noite');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('escala.workspace.v1')!).shifts.length)).toBe(0);
 await dialog.getByLabel('Entrada dos turnos').fill('08:00');await dialog.getByRole('button',{name:'Gerar prévia'}).click();await expect(dialog.getByRole('status')).toContainText('Faltam');await expect(dialog.getByRole('button',{name:'Aplicar escala do mês'})).toBeDisabled();await dialog.getByLabel('Revisarei os dias com cobertura pendente',{exact:false}).check();await dialog.getByRole('button',{name:'Aplicar escala do mês'}).click();await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('escala.workspace.v1')!).shifts.length)).toBeGreaterThan(0);
});
test('server rejection leaves the workspace unchanged and a discarded preview is never persisted',async({page})=>{
 const before=await page.evaluate(()=>localStorage.getItem('escala.workspace.v1'));
 await page.getByRole('button',{name:'Gerar escala',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.getByLabel('Mês da geração').fill(month);await dialog.getByRole('button',{name:'Gerar prévia'}).click();await expect(dialog.getByRole('region',{name:'Prévia da escala'})).toBeVisible({timeout:30000});await dialog.getByRole('button',{name:'Descartar prévia'}).click();expect(await page.evaluate(()=>localStorage.getItem('escala.workspace.v1'))).toBe(before);
 await page.getByRole('button',{name:'Gerar escala',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Mês da geração').fill(month);await dialog.getByRole('button',{name:'Gerar prévia'}).click();await expect(dialog.getByRole('region',{name:'Prévia da escala'})).toBeVisible({timeout:30000});
 await page.route('**/api/validate',route=>route.fulfill({json:{valid:false,issues:[{severity:'error',message:'Conflito detectado pelo servidor.'}]}}));
 const acceptance=dialog.getByLabel('Revisarei os dias com cobertura pendente',{exact:false});if(await acceptance.count())await acceptance.check();await dialog.getByRole('button',{name:'Aplicar escala do mês'}).click();await expect(dialog.locator('.form-errors')).toContainText('Conflito detectado pelo servidor');expect(await page.evaluate(()=>localStorage.getItem('escala.workspace.v1'))).toBe(before);
});
