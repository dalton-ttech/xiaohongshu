const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root='http://127.0.0.1:8765';
const output=path.resolve('.local/qa/visitor');
const password=Object.fromEntries(fs.readFileSync('.dev.vars','utf8').split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];})).ACCESS_PASSWORD;
const identityPattern=/^访客 2610(?:0[1-9]|[1-9]\d)$/;

(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[],violations=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('reportCsp',directive=>violations.push(directive));
  await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.reportCsp(e.violatedDirective+': '+e.blockedURI)));
  await page.goto(root+'/#wechat/directory');
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#account').inputValue(),'访客');
  assert.equal(await page.locator('#account').getAttribute('readonly'),'');
  assert.equal(await page.locator('#password').getAttribute('placeholder'),'1105');
  assert.equal(await page.locator('#password').inputValue(),'');
  assert.equal((await context.request.get(root+'/assets/accounts.js')).status(),401);
  for(const width of [360,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Entry overflow at '+width);
  }
  await page.screenshot({path:path.join(output,'entry-desktop.png'),animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(output,'entry-mobile.png'),animations:'disabled'});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#password').fill('wrong-password');
  await page.getByRole('button',{name:'确认进入'}).click();
  await page.waitForFunction(()=>document.getElementById('accessError').textContent.includes('密码不正确'));
  assert.ok(await page.locator('#accessArrival').isHidden());
  assert.equal((await context.request.get(root+'/assets/accounts.js')).status(),401);
  await page.route('**/auth/login',route=>route.abort());
  await page.locator('#password').fill(password);
  await page.getByRole('button',{name:'确认进入'}).click();
  await page.waitForFunction(()=>document.getElementById('accessError').textContent.includes('网络连接失败'));
  assert.ok(await page.locator('#accessSubmit').isEnabled());
  await page.unroute('**/auth/login');
  await page.getByRole('button',{name:'确认进入'}).click();
  await page.locator('#accessArrival').waitFor({state:'visible'});
  assert.equal(await page.locator('#arrivalTitle').textContent(),'欢迎进入图灵看板');
  assert.equal(await page.locator('.arrival-message p').textContent(),'访客权限已开通');
  await page.screenshot({path:path.join(output,'welcome.png'),animations:'disabled'});
  await page.locator('#channelGrid .channel-card').first().waitFor();
  assert.ok(page.url().endsWith('#wechat/directory'));
  assert.equal(await page.locator('#channelGrid .channel-card').count(),18);
  await page.locator('#visitorBadge').hover();
  await page.locator('#visitorIdentity').waitFor({state:'visible'});
  assert.ok(await page.locator('#visitorIdentity').isVisible());
  const identity=await page.locator('#visitorIdentity').textContent();
  assert.match(identity,identityPattern);
  await page.screenshot({path:path.join(output,'badge-desktop.png'),animations:'disabled'});
  await page.reload();
  await page.locator('#visitorBadge').focus();
  await page.locator('#visitorIdentity').waitFor({state:'visible'});
  assert.equal(await page.locator('#visitorIdentity').textContent(),identity);
  assert.ok(await page.locator('#visitorIdentity').isVisible());
  await page.locator('#visitorBadge').press('Escape');
  await page.waitForFunction(()=>!document.querySelector('.visitor-account').classList.contains('is-open'));
  for(const width of [360,390,768,1440]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Header overflow at '+width);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#visitorBadge').click();
  await page.screenshot({path:path.join(output,'badge-mobile.png'),animations:'disabled'});
  await page.getByRole('button',{name:'退出',exact:true}).click();
  await page.locator('#accessForm').waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('turing-visitor-id')),null);
  assert.equal((await context.request.get(root+'/assets/accounts.js')).status(),401);

  await context.close();
  const reduced=await browser.newContext({reducedMotion:'reduce'}),reducedPage=await reduced.newPage();
  await reducedPage.goto(root);
  assert.equal(await reducedPage.locator('.access-card').evaluate(e=>getComputedStyle(e).animationName),'none');
  await reducedPage.locator('#password').fill(password);await reducedPage.getByRole('button',{name:'确认进入'}).click();
  await reducedPage.locator('#grid .card').first().waitFor();
  assert.match(await reducedPage.locator('#visitorIdentity').textContent(),identityPattern);

  await reduced.close();
  const plain=await browser.newContext({javaScriptEnabled:false,reducedMotion:'reduce'}),plainPage=await plain.newPage();
  await plainPage.goto(root);await plainPage.locator('#password').fill(password);await plainPage.getByRole('button',{name:'确认进入'}).click();
  await plainPage.locator('#visitorBadge').waitFor();
  assert.equal((await plain.request.get(root+'/assets/accounts.js')).status(),200);
  assert.deepEqual(errors,[]);assert.deepEqual(violations,[]);
  console.log(JSON.stringify({entry:true,welcome:true,identity,refreshStable:true,reducedMotion:true,nativeForm:true,errors,violations,output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
