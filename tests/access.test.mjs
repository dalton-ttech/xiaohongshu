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

test('only entry presentation assets are public; visitor page advertises the hint without relaxing CSP',async()=>{
  for(const path of ['/assets/access.css','/assets/access.js','/assets/brand/turingtouch-logo.png','/assets/fonts/access-manrope.woff2','/assets/fonts/access-noto.woff2']){
    const response=await run(request(path));assert.equal(response.status,200);
    assert.equal((await run(request(path,{method:'POST'}))).status,401);
  }
  for(const path of ['/assets/catalog.js','/research/xhs-personal-papers-2026-10-12.json','/assets/fonts/other.woff2'])assert.equal((await run(request(path))).status,401);
  const page=await run(request()),html=await page.text();
  assert.match(html,/name="account" value="访客" readonly/);
  assert.match(html,/placeholder="1105"/);
  assert.match(html,/欢迎进入图灵看板/);assert.match(html,/访客权限已开通/);
  assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
  assert.ok(!page.headers.get('content-security-policy').includes('unsafe-inline'));
});

test('animated login returns a signed session only after successful verification',async()=>{
  const options={method:'POST',headers:{Origin:origin,Accept:'application/json'}};
  const denied=await run(request('/auth/login',{...options,body:'account=访客&password=wrong'}));
  assert.equal(denied.status,401);assert.equal((await denied.json()).ok,false);assert.equal(denied.headers.get('set-cookie'),null);
  const accepted=await run(request('/auth/login',{...options,body:'account=访客&password=test-password'}));
  assert.equal(accepted.status,200);assert.deepEqual(await accepted.json(),{ok:true});
  const cookie=accepted.headers.get('set-cookie').split(';')[0];
  assert.equal((await run(request('/assets/accounts.js',{headers:{Cookie:cookie}}))).status,200);
  assert.equal((await run(request('/auth/login',{...options,headers:{...options.headers,Origin:'https://other.example'},body:'password=test-password'}))).status,403);
  const oversized=await run(request('/auth/login',{...options,body:'password='+ 'x'.repeat(1030)}));assert.equal(oversized.status,400);assert.equal((await oversized.json()).ok,false);
});
