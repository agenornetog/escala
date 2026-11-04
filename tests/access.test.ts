import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { loginRequired, OPEN_ACCESS_UNTIL } from '../lib/access';
import { POST } from '../app/api/validate/route';
import { proxy } from '../proxy';
import { defaultRules } from '../lib/validation';
import { configureTestAuth } from './auth-fixture';
configureTestAuth();
const deadline=Date.parse(OPEN_ACCESS_UNTIL);
test('temporary access expires at a fixed deadline even if the flag remains false',()=>{
 try {
  delete process.env.ESCALA_REQUIRE_LOGIN;assert.equal(loginRequired(deadline-1),false);assert.equal(loginRequired(deadline),true);
  process.env.ESCALA_REQUIRE_LOGIN='false';assert.equal(loginRequired(deadline-1),false);assert.equal(loginRequired(deadline),true);assert.equal(loginRequired(deadline+86400000),true);
  for(const value of ['true','invalid','']){process.env.ESCALA_REQUIRE_LOGIN=value;assert.equal(loginRequired(deadline-1),true);}
 } finally {configureTestAuth();}
});
test('public validation still checks labor rules; expiry closes both the API and proxy',async()=>{
 process.env.ESCALA_REQUIRE_LOGIN='false';mock.timers.enable({apis:['Date'],now:deadline-3600000});
 const employee={id:'a',name:'Teste',role:'Técnico',team:'Campo',regime:'5x2',color:'blue',sundayEvery:3};
 const request=(data:unknown)=>new Request('http://localhost/api/validate',{method:'POST',body:JSON.stringify(data)});
 try {
  let response=await POST(request({employees:[],shifts:[],rules:defaultRules}));assert.equal(response.status,200);assert.equal((await response.json()).valid,true);
  assert.equal(proxy(new NextRequest('http://localhost/')).headers.get('x-middleware-next'),'1');
  response=await POST(request({employees:[employee],shifts:[{id:'s',employeeId:'a',date:'2026-11-04',start:'08:00',end:'18:00',breakMinutes:60}],rules:defaultRules}));assert.equal((await response.json()).valid,false);
  assert.equal((await POST(request({}))).status,400);
  mock.timers.setTime(deadline);
  assert.equal((await POST(request({employees:[],shifts:[],rules:defaultRules}))).status,401);
  const redirected=proxy(new NextRequest('http://localhost/'));assert.equal(new URL(redirected.headers.get('location')!).pathname,'/login');
  assert.equal(proxy(new NextRequest('http://localhost/api/validate')).status,401);
 } finally {mock.timers.reset();configureTestAuth();}
});
