const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root='http://127.0.0.1:8765';
const output=path.resolve('.local/qa/research');
const data=JSON.parse(fs.readFileSync('public/research/xhs-personal-papers-2026-10-12.json','utf8'));
const password=Object.fromEntries(fs.readFileSync('.dev.vars','utf8').split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];})).ACCESS_PASSWORD;

(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.cspViolations=[];
   document.addEventListener('securitypolicyviolation',e=>window.cspViolations.push(e.violatedDirective+': '+e.blockedURI));
  });
  const report='/research/xhs-personal-papers-2026-10-12.html';
  assert.equal((await context.request.get(root+report)).status(),401);
  await page.goto(root);
  await page.locator('#password').fill(password);
  await page.getByRole('button',{name:'确认进入'}).click();
  await page.locator('#grid .card').first().waitFor();
  assert.equal(await page.locator('#grid .card').count(),109);
  const originalIds=await page.evaluate(()=>window.XHS_ACCOUNTS.map(r=>r.redId.toLowerCase()));
  assert.equal(data.candidates.length,12);
  assert.equal(new Set(data.candidates.map(r=>r.redId.toLowerCase())).size,12);
  assert.ok(data.candidates.every(r=>!originalIds.includes(r.redId.toLowerCase())));
  await page.getByRole('link',{name:'打开专项名单 ↗'}).click();
  await page.locator('article').first().waitFor();
  assert.equal(await page.locator('article:visible').count(),12);
  await page.locator('[data-filter="first"]').click();
  assert.equal(await page.locator('article:visible').count(),6);
  await page.locator('[data-filter="fresh"]').click();
  assert.equal(await page.locator('article:visible').count(),8);
  await page.locator('[data-filter="all"]').click();
  await page.locator('#search').fill(data.candidates[0].redId);
  assert.equal(await page.locator('article:visible').count(),1);
  await page.locator('#copy').click();
  await page.waitForFunction(()=>!document.querySelector('#copyBox').hidden);
  const copied=await page.locator('#copyText').inputValue();
  assert.ok(copied.includes(data.candidates[0].redId));
  assert.ok(copied.includes('https://www.xiaohongshu.com/user/profile/'+data.candidates[0].profileId));
  assert.ok(!copied.includes(data.candidates[1].redId));
  await page.locator('#search').fill('no-matching-account-qa');
  assert.equal(await page.locator('article:visible').count(),0);
  assert.ok(await page.locator('#empty').isVisible());
  await page.locator('#search').fill('');
  for(const width of [360,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Report overflow at '+width);
  }
  for(const stem of ['xhs-personal-papers-2026-10-12','douyin-koc-2026-10-09','douyin-koc-round6-2026-10-09']){
   const response=await page.goto(root+'/research/'+stem+'.html');
   assert.equal(response.status(),200);
   assert.match(response.headers()['content-security-policy'],/script-src 'self'/);
   assert.ok(await page.evaluate(()=>[...document.styleSheets].some(sheet=>sheet.href&&sheet.cssRules.length>0)),stem+' styles failed');
   assert.deepEqual(await page.evaluate(()=>window.cspViolations),[],stem+' CSP violations');
   await page.screenshot({path:path.join(output,stem+'.png')});
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({reports:3,xhsPersonalCandidates:12,newAgainstPrevious:8,priority:6,errors,output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
