const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root='http://127.0.0.1:8765',output=path.resolve('.local/qa/platforms');fs.mkdirSync(output,{recursive:true});
const password=Object.fromEntries(fs.readFileSync('.dev.vars','utf8').split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];})).ACCESS_PASSWORD;
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root);await page.locator('#password').fill(password);await page.getByRole('button',{name:'进入工作空间 →'}).click();await page.locator('#grid .card').first().waitFor();
  assert.equal(await page.locator('#grid .card').count(),109);await page.locator('[data-platform="wechat"]').click();assert.equal(await page.locator('#channelGrid .channel-card').count(),18);
  assert.equal(await page.locator('#navTrackedCount').textContent(),'0');assert.ok((await page.locator('#channelGrid').textContent()).includes('公众号微信号待核实'));
  await page.screenshot({path:path.join(output,'wechat-desktop.png')});
  for(const width of [360,390,768,1100,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Wechat overflow ${width}`);}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'wechat-mobile.png')});await page.setViewportSize({width:1440,height:1000});
  await page.locator('#catalogQuery').fill('AINLP');assert.equal(await page.locator('#channelGrid .channel-card').count(),2);
  await page.locator('[data-platform="douyin"]').click();assert.ok((await page.locator('#channelGrid').textContent()).includes('添加第一个账号'));await page.screenshot({path:path.join(output,'douyin-empty.png')});
  await page.locator('[data-platform="wechat"]').click();assert.equal(await page.locator('#catalogQuery').inputValue(),'AINLP');
  await page.locator('[data-channel-select="1001"]').check();await page.locator('#catalogCopy').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'AINLP\t公众号微信号待核实');
  await page.locator('.channel-title[data-channel-preview="1001"]').click();await page.locator('#channelEditAccount').click();
  await page.locator('#accountId').fill('00001234');await page.locator('#accountContactPerson').fill('联系人测试，不是平台ID');await page.locator('#accountImage').setInputFiles('public/assets/profiles/001.jpg');await page.locator('#accountProfile').fill('https://example.com/wechat');await page.locator('#accountCase').fill('https://example.com/article');
  await page.getByRole('button',{name:'保存账号资料',exact:true}).click();await page.locator('#accountEditor').waitFor({state:'hidden'});
  await page.locator('[data-channel-select="1007"]').check();await page.locator('#catalogTrack').click();await page.locator('[data-board="tracker"]').click();assert.equal(await page.locator('#trackerBody tr').count(),2);
  await page.locator('#trackerAssign').click();await page.locator('#batchOwner').fill('同事甲');await page.locator('#batchSave').click();assert.ok((await page.locator('#trackerBody').textContent()).includes('同事甲'));assert.ok((await page.locator('#trackerBody').textContent()).includes('待核实'));
  await page.locator('#trackerSent').click();await page.locator('#batchDate').fill('2026-10-08');await page.locator('#batchChannel').selectOption('公众号后台');await page.locator('#batchSave').click();
  await page.locator('[data-edit-progress="1001"]').click();assert.equal(await page.locator('#editFirst').getAttribute('type'),'date');assert.equal(await page.locator('#editFirst').inputValue(),'2026-10-08');assert.equal(await page.locator('#editStatus').inputValue(),'已发送，待回复');
  const today=await page.evaluate(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));await page.locator('#editNext').fill(today);await page.getByRole('button',{name:'保存本机进度',exact:true}).click();
  await page.locator('[data-platform="douyin"]').click();assert.equal(await page.locator('#trackerBody tr').count(),0);await page.locator('[data-board="directory"]').click();await page.locator('#addAccount').click();
  await page.locator('#accountName').fill('浏览器验证账号');await page.locator('#accountId').fill('00001234');await page.locator('#accountGroup').fill('AI 科普');await page.locator('#accountProfile').fill('https://www.douyin.com/user/example');await page.getByRole('button',{name:'保存账号资料',exact:true}).click();await page.locator('#accountEditor').waitFor({state:'hidden'});assert.equal(await page.locator('#channelGrid .channel-card').count(),1);assert.ok((await page.locator('#channelGrid').textContent()).includes('待补充'));
  await page.locator('[data-channel-select]').check();await page.locator('#catalogTrack').click();await page.locator('[data-board="tracker"]').click();assert.equal(await page.locator('#trackerBody tr').count(),1);
  await page.reload();await page.locator('#trackerBody tr').first().waitFor();assert.equal(await page.locator('#trackerBody tr').count(),1);
  await page.locator('[data-platform="xhs"]').click();assert.equal(await page.locator('#trackerBody tr').count(),57);await page.locator('[data-tracker-select="6"]').check();
  await page.locator('#todayWork').click();assert.equal(await page.locator('#trackerBody tr').count(),1);assert.ok((await page.locator('#trackerBody').textContent()).includes('AINLP'));await page.locator('#trackerReset').click();assert.equal(await page.locator('#trackerBody tr').count(),60);
  await page.locator('#trackerCopy').click();const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.ok(copied.includes('微信公众号\tAINLP\t00001234'));assert.ok(copied.includes('抖音\t浏览器验证账号\t00001234'));assert.ok(!copied.includes('联系人测试'));
  const excelPending=page.waitForEvent('download');await page.locator('#trackerExcel').click();await(await excelPending).saveAs(path.join(output,'three-platforms.xlsx'));
  const workbook=await page.evaluate(async()=>{const rows=JSON.parse(localStorage.getItem('jev-xhs-progress-v1'));return rows.accounts.map(r=>({uid:r.uid,platform:r.platform}));});assert.equal(workbook.length,2);
  await page.locator('.backup-tools summary').click();const backupPending=page.waitForEvent('download');await page.locator('#trackerBackup').click();const backupPath=path.join(output,'progress-v2.json');await(await backupPending).saveAs(backupPath);
  const fresh=await browser.newContext();await fresh.addCookies(await context.cookies());const next=await fresh.newPage();await next.goto(root+'/#all/tracker');await next.locator('#trackerBody tr').first().waitFor();assert.equal(await next.locator('#trackerBody tr').count(),57);
  await next.locator('#progressFile').setInputFiles(backupPath);await next.locator('#importPreview').waitFor();assert.equal(await next.locator('#importRows input').count(),3);for(const checkbox of await next.locator('#importRows input').all())await checkbox.check();await next.locator('#confirmImport').click();assert.equal(await next.locator('#trackerBody tr').count(),60);await next.reload();await next.locator('#trackerBody tr').first().waitFor();assert.equal(await next.locator('#trackerBody tr').count(),60);
  for(const width of [360,390,768,1100,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Tracker overflow ${width}`);}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'tracker-mobile.png')});await page.locator('[data-edit-progress="1001"]').click();assert.ok(await page.evaluate(()=>document.querySelector('#progressEditor').scrollWidth<=innerWidth));await page.screenshot({path:path.join(output,'editor-mobile.png')});await page.locator('#closeEditor').click();
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(output,'tracker-all.png')});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({wechatCandidates:18,oldXhsAccounts:109,trackedWithFixtures:60,errors,output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
