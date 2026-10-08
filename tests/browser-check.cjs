// Run with Playwright available in NODE_PATH: node tests/browser-check.cjs
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const output=path.resolve('.local/qa');fs.mkdirSync(output,{recursive:true});
const context={window:{}};vm.runInNewContext(fs.readFileSync('public/assets/accounts.js','utf8'),context);
const data=context.window.XHS_ACCOUNTS;
const reserve=data.find(r=>r.pool==='备选');
const root='http://127.0.0.1:8765';
const password=Object.fromEntries(fs.readFileSync('.dev.vars','utf8').split(/\r?\n/).filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];})).ACCESS_PASSWORD;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const browserContext=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  const page=await browserContext.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root);assert.ok((await page.title()).includes('团队访问'));
  assert.equal((await browserContext.request.get(root+'/assets/accounts.js')).status(),401);
  await page.locator('#password').fill('incorrect');await page.getByRole('button',{name:'进入工作空间 →'}).click();await page.locator('.error').filter({hasText:'密码不正确'}).waitFor();
  await page.locator('#password').fill(password);await page.getByRole('button',{name:'进入工作空间 →'}).click();await page.locator('#grid .card').first().waitFor();assert.equal(await page.locator('#grid .card').count(),109);
  await page.locator('[data-board="tracker"]').click();assert.equal(await page.locator('#trackerBody tr').count(),57);
  for(const [key,count] of Object.entries({all:57,uncontacted:16,waiting:27,replied:12,blocked:1,completed:0,declined:1})){await page.locator(`[data-tracker-stage="${key}"]`).click();assert.equal(await page.locator('#trackerBody tr').count(),count);}
  await page.locator('#trackerReset').click();
  for(const order of [30,31,36,45,46,48,69]){
   const row=page.locator(`#trackerBody tr[data-order="${order}"]`);
   assert.ok((await row.textContent()).includes('已私信，待回复'));
   await row.locator('[data-edit-progress]').click();
   assert.equal(await page.locator('#editOwner').inputValue(),'同事');
   assert.ok((await page.locator('#editorHistory').textContent()).includes('2026-10-08 同事已私信建联'));
   assert.equal(await page.locator('#editFirst').inputValue(),'');
   await page.locator('#closeEditor').click();
  }
  for(const order of [32,64])assert.ok((await page.locator(`#trackerBody tr[data-order="${order}"]`).textContent()).includes('未建联'));
  await page.locator('#trackerReset').click();await page.locator('#trackerGroup').selectOption('法律 × AI');assert.equal(await page.locator('#trackerBody tr').count(),8);await page.locator('#trackerReset').click();
  await page.locator('[data-edit-progress="6"]').click();assert.equal(await page.locator('#editFirst').inputValue(),'');
  await page.locator('#editOwner').fill('同事甲');await page.locator('#editStatus').selectOption('沟通中');
  await page.locator('#editFirst').fill('2026-10-05T10:00');await page.locator('#editLast').fill('2026-10-08T14:30');
  const today=await page.evaluate(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  await page.locator('#editNext').fill(today);await page.locator('#editNote').fill('<测试备注> 不作为 HTML 执行');await page.locator('#editMessage').fill('已发送资料，等待回复');
  await page.getByRole('button',{name:'保存本机进度'}).click();assert.equal(await page.locator('#progressEditor').isVisible(),false);
  await page.locator('[data-tracker-stage="due"]').click();assert.equal(await page.locator('#trackerBody tr').count(),1);await page.locator('#trackerOwner').selectOption('同事甲');
  await page.locator('[data-tracker-select="6"]').check();await page.locator('#trackerCopy').click();
  const pacino=data.find(r=>r.order===6);assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),pacino.name+'\t'+pacino.redId);
  await page.locator('[data-edit-progress="6"]').click();assert.equal(await page.locator('#editorHistory li').count(),2);assert.ok((await page.locator('#editorHistory').textContent()).includes('已发送资料'));
  await page.locator('#editFirst').fill('2026-10-09T10:00');await page.getByRole('button',{name:'保存本机进度'}).click();assert.ok((await page.locator('#editorError').textContent()).includes('不能早于'));await page.locator('#closeEditor').click();
  await page.locator('#trackerReset').click();await page.locator('[data-board="directory"]').click();assert.ok((await page.locator('#grid .card[data-order="6"]').textContent()).includes('沟通中'));
  await page.locator('#query').fill(reserve.name);await page.locator(`[data-preview="${reserve.order}"]`).click();await page.locator("#previewFollowup").click();assert.ok((await page.locator('#editorSource').textContent()).includes('保存后'));await page.getByRole('button',{name:'保存本机进度'}).click();assert.equal(await page.locator('#navTrackedCount').textContent(),'58');
  await page.locator('#query').fill('');assert.equal(await page.locator('#grid .card').count(),109);assert.equal(await page.locator("[data-view], #tableView, #progressFilters").count(),0);
  await page.locator('[data-top="10"]').click();assert.equal(await page.locator('#grid .card').count(),10);await page.locator('[data-top="0"]').click();
  await page.locator('[data-board="tracker"]').click();await page.locator(`[data-tracker-select="${reserve.order}"]`).check();
  const xlsxPending=page.waitForEvent('download');await page.locator('#trackerExcel').click();const xlsx=await xlsxPending;await xlsx.saveAs(path.join(output,'selected.xlsx'));
  await page.locator('.backup-tools summary').click();const backupPending=page.waitForEvent('download');await page.locator('#trackerBackup').click();const backup=await backupPending;const backupPath=path.join(output,'progress.json');await backup.saveAs(backupPath);const payload=JSON.parse(fs.readFileSync(backupPath));assert.equal(payload.records.length,58);
  await page.reload();await page.locator('#trackerBody tr').first().waitFor();assert.equal(await page.locator('#trackerBody tr').count(),58);assert.ok((await page.locator('#trackerBody tr[data-order="6"]').textContent()).includes('同事甲'));
  // Fresh device: preview and explicitly import only changed records.
  const secondContext=await browser.newContext();await secondContext.addCookies(await browserContext.cookies());const second=await secondContext.newPage();await second.goto(root+'/#tracker');await second.locator('#trackerBody tr').first().waitFor();assert.equal(await second.locator('#trackerBody tr').count(),57);
  await second.locator('#progressFile').setInputFiles(backupPath);await second.locator('#importPreview').waitFor();assert.equal(await second.locator('#importRows input').count(),2);await second.locator('#confirmImport').click();assert.equal(await second.locator('#trackerBody tr').count(),58);
  // Existing record conflicts are unchecked. Explicit choice keeps both histories.
  await second.locator('[data-edit-progress="6"]').click();await second.locator('#editOwner').fill('同事乙');await second.locator('#editMessage').fill('同事乙补充记录');await second.getByRole('button',{name:'保存本机进度'}).click();
  await second.locator('#progressFile').setInputFiles(backupPath);assert.equal(await second.locator('#importRows input').count(),1);assert.equal(await second.locator('#importRows input').isChecked(),false);await second.locator('#importRows input').check();await second.locator('#confirmImport').click();await second.locator('[data-edit-progress="6"]').click();assert.equal(await second.locator('#editorHistory li').count(),3);await second.locator('#closeEditor').click();
  for(const width of [360,390,700,768,1100,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`tracker overflow ${width}`);}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'tracker-mobile.png')});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(output,'tracker-desktop.png')});
  await page.locator('[data-board="directory"]').click();for(const width of [360,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`directory overflow ${width}`);}
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(output,'directory-desktop.png')});
  assert.equal(errors.length,0,errors.join('\n'));await page.getByRole('button',{name:'退出',exact:true}).click();await page.locator('#password').waitFor();assert.equal((await browserContext.request.get(root+'/assets/profiles/006.jpg')).status(),401);
  console.log(JSON.stringify({directory:109,defaultTracked:57,trackedAfterReserve:58,checks:['login/logout','private assets','all stage filters','owner and due filters','actual dates','history','clipboard','cross-board state','reserve inclusion','xlsx screenshots','backup','import preview','conflict merge','reload persistence','10 responsive checks'],browserErrors:errors,output}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
