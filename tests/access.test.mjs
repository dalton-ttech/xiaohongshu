import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequest} from '../functions/_middleware.js';
const env={ACCESS_PASSWORD:'test-password',ACCESS_SESSION_SECRET:'0123456789012345678901234567890123456789'};
const origin='https://test.example';
const request=(path='/',init={})=>new Request(origin+path,init);
const run=(req,config=env)=>onRequest({request:req,env:config,next:()=>new Response('private data')});
async function login(){return run(request('/auth/login',{method:'POST',headers:{Origin:origin},body:'password=test-password'}));}
test('login wall and direct static assets are protected; missing secrets fail closed',async()=>{
  const root=await run(request());assert.equal(root.status,200);assert.ok((await root.text()).includes('访问密码'));
  for(const path of ['/assets/accounts.js','/assets/progress.js','/assets/profiles/006.jpg','/assets/vendor/jszip.min.js'])assert.equal((await run(request(path))).status,401);
  assert.equal((await run(request(),{})).status,503);
});
test('incorrect passwords and cross-site submissions are rejected',async()=>{
  assert.equal((await run(request('/auth/login',{method:'POST',headers:{Origin:origin},body:'password=wrong'}))).status,401);
  assert.equal((await run(request('/auth/login',{method:'POST',headers:{Origin:'https://other.example'},body:'password=test-password'}))).status,403);
});
test('signed sessions allow assets; tampering and password rotation invalidate them',async()=>{
  const response=await login();assert.equal(response.status,303);
  const setCookie=response.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Lax'])assert.ok(setCookie.includes(flag));
  const cookie=setCookie.split(';')[0];
  const asset=await run(request('/assets/accounts.js',{headers:{Cookie:cookie}}));assert.equal(await asset.text(),'private data');assert.equal(asset.headers.get('cache-control'),'private, no-store');
  assert.equal((await run(request('/assets/accounts.js',{headers:{Cookie:cookie+'x'}}))).status,401);
  assert.equal((await run(request('/assets/accounts.js',{headers:{Cookie:cookie}}),{...env,ACCESS_PASSWORD:'changed'})).status,401);
});
test('logout clears session and authenticated requests cannot write data',async()=>{
  const cookie=(await login()).headers.get('set-cookie').split(';')[0];
  const logout=await run(request('/auth/logout',{method:'POST',headers:{Origin:origin,Cookie:cookie}}));assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
  assert.equal((await run(request('/assets/progress.js',{method:'POST',headers:{Cookie:cookie},body:'bad'}))).status,405);
});
