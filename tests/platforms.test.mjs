import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {createProgressStore,validateBackup,STORAGE_KEY,sameValue} from '../public/assets/progress-model.js';
import {copyAccounts,mergeCatalog} from '../public/assets/catalog.js';
const context={window:{}};
for(const path of ['accounts.js','platform-data.js','progress.js'])vm.runInNewContext(fs.readFileSync(new URL('../public/assets/'+path,import.meta.url),'utf8'),context);
const data=[...context.window.XHS_ACCOUNTS,...context.window.XHS_PLATFORM_ACCOUNTS];
const published=context.window.XHS_PUBLISHED_PROGRESS;
function disk(){const values=new Map();return{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};}
const custom={order:900000,platform:'douyin',uid:'DY-TEST01',name:'测试视频账号',redId:'00001234',group:'AI 科普',fans:null,profile:'https://www.douyin.com/user/example',image:'',verification:'待核实',source:'测试来源'};

test('existing XHS drafts and IDs migrate without losing histories; candidates stay unverified',()=>{
 const storage=disk(),legacy=createProgressStore(context.window.XHS_ACCOUNTS,published,storage);
 legacy.save(6,{owner:'原负责人'},'原历史');
 const payload=JSON.parse(storage.getItem(STORAGE_KEY));payload.version=1;delete payload.accounts;for(const r of payload.records){delete r.platform;delete r.uid;delete r.channel;}
 storage.setItem(STORAGE_KEY,JSON.stringify(payload));
 const next=createProgressStore(data,published,storage);
 assert.equal(next.trackedRows().length,57);assert.equal(next.accounts().length,127);
 assert.equal(next.get(6).owner,'原负责人');assert.equal(next.get(6).history[0].message,'原历史');
 assert.equal(next.get(1001).status,'待核实');assert.equal(next.get(1001).tracked,false);
 next.save(6,{note:'新增备注'});assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version,2);
 assert.equal(next.get(30).status,'已私信，待回复');
});
test('custom accounts, identity edits, date precision and backups survive a new device',()=>{
 const a=createProgressStore(data,published,disk());a.saveAccount(custom);
 a.save(custom.order,{tracked:true,status:'已发送，待回复',channel:'私信',firstContactAt:'2026-10-08',lastContactAt:'2026-10-08'},'实际发送');
 a.saveAccount({...custom,redId:'00005678'});
 const b=createProgressStore(data,published,disk()),bundle=b.previewImport(a.backup());b.importRecords(bundle.records,bundle.overrides);
 assert.equal(b.get(custom.order).redId,'00005678');assert.equal(b.get(custom.order).firstContactAt,'2026-10-08');assert.equal(b.get(custom.order).history.length,1);
 assert.equal(b.accounts().find(r=>r.order===custom.order).fans,null);
 assert.ok(copyAccounts([b.accounts().find(r=>r.order===custom.order)]).includes('00005678'));
 assert.ok(sameValue(b.previewImport(b.backup()).records.find(r=>r.order===custom.order),b.get(custom.order)));
});
test('same-platform identity collisions, cross-platform substitution and unsafe URLs are rejected',()=>{
 const store=createProgressStore(data,published,disk());store.saveAccount(custom);
 assert.throws(()=>store.saveAccount({...custom,order:900001,uid:'DY-TEST02'}),/已有/);
 assert.throws(()=>store.saveAccount({...custom,profile:'javascript:alert(1)'}),/链接/);
 const backup=store.backup();backup.records.find(r=>r.order===custom.order).platform='wechat';
 assert.throws(()=>validateBackup(backup,store.accounts()),/身份/);
 assert.throws(()=>mergeCatalog(data,[{...custom,order:1001}]),/冲突/);
});
test('batch saves are atomic and assignment never overwrites established progress',()=>{
 const storage=disk(),store=createProgressStore(data,published,storage);
 store.saveMany([6,32],p=>({owner:'同事乙',status:p.status==='未建联'?'已分配，待发送':p.status}),'分配');
 assert.equal(store.get(6).status,'已回复，待跟进');assert.equal(store.get(32).status,'已分配，待发送');
 const before=storage.getItem(STORAGE_KEY);
 assert.throws(()=>store.saveMany([6,32],p=>({lastContactAt:p.order===32?'2026-02-30':'2026-10-08'})));
 assert.equal(storage.getItem(STORAGE_KEY),before);
 const failed=createProgressStore(data,published,{getItem:()=>null,setItem:()=>{throw Error('quota');}});
 assert.throws(()=>failed.saveAccount(custom),/保存失败/);assert.equal(failed.accounts().length,127);
});
test('date-only chronology uses available precision and unknown IDs never become contact-person IDs',()=>{
 const store=createProgressStore(data,published,disk());store.save(6,{firstContactAt:'2026-10-08T11:20',lastContactAt:'2026-10-08'});
 assert.throws(()=>store.save(6,{lastContactAt:'2026-10-07'}),/不能早于/);
 assert.throws(()=>store.save(6,{firstContactAt:'2026-02-30'}),/有效日期/);
 const wx=store.accounts().find(r=>r.order===1001);wx.contactPerson='私人联系人';assert.equal(copyAccounts([wx]),'AINLP\t公众号微信号待核实');
});

test('metadata-only edits are visible as local changes and survive reload',()=>{
 const storage=disk(),store=createProgressStore(data,published,storage);
 const account=store.accounts().find(r=>r.order===1001);store.saveAccount({...account,reviewReason:'补充选题资料'});
 assert.equal(store.isDraft(1001),true);assert.equal(store.draftCount(),1);
 const reloaded=createProgressStore(data,published,storage);assert.equal(reloaded.isDraft(1001),true);assert.equal(reloaded.accounts().find(r=>r.order===1001).reviewReason,'补充选题资料');
});

test('publishing v2 then an old XHS backup preserves new-platform accounts and validates before writing',()=>{
 const fixture=path.resolve('.local/publish-platform-test-'+crypto.randomUUID());
 for(const folder of ['scripts','public/assets'])fs.mkdirSync(path.join(fixture,folder),{recursive:true});
 fs.writeFileSync(path.join(fixture,'package.json'),'{"type":"module"}');
 for(const file of ['scripts/apply-progress.mjs','public/assets/progress-model.js','public/assets/catalog.js','public/assets/accounts.js','public/assets/platform-data.js','public/assets/progress.js'])fs.copyFileSync(file,path.join(fixture,file));
 const source=createProgressStore(data,published,disk());source.saveAccount(custom);source.save(custom.order,{tracked:true,status:'已发送，待回复',lastContactAt:'2026-10-08'},'已发送');
 const input=path.join(fixture,'input.json'),target=path.join(fixture,'public/assets/progress.js'),script=path.join(fixture,'scripts/apply-progress.mjs');
 fs.writeFileSync(input,JSON.stringify(source.backup()));execFileSync(process.execPath,[script,input]);
 const legacy={schema:'jev-xhs-progress',version:1,records:[source.get(6)]};fs.writeFileSync(input,JSON.stringify(legacy));execFileSync(process.execPath,[script,input]);
 const output={window:{}};vm.runInNewContext(fs.readFileSync(target,'utf8'),output);
 assert.equal(output.window.XHS_PUBLISHED_PROGRESS.accounts.length,1);assert.ok(output.window.XHS_PUBLISHED_PROGRESS.records.some(r=>r.order===custom.order));
 const before=fs.readFileSync(target,'utf8');legacy.records[0].redId='incorrect';fs.writeFileSync(input,JSON.stringify(legacy));
 assert.throws(()=>execFileSync(process.execPath,[script,input],{stdio:'pipe'}));assert.equal(fs.readFileSync(target,'utf8'),before);
});
