import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {validateAccount,filterPlatformAccounts} from '../public/assets/catalog.js';
import {createProgressStore} from '../public/assets/progress-model.js';
import {exportAccountXlsx} from '../public/assets/xlsx-export.js';

const context={window:{}};
for(const file of ['accounts.js','platform-data.js','progress.js'])vm.runInNewContext(fs.readFileSync(new URL('../public/assets/'+file,import.meta.url),'utf8'),context);
const data=[...context.window.XHS_ACCOUNTS,...context.window.XHS_PLATFORM_ACCOUNTS];
const douyin=data.filter(r=>r.platform==='douyin');
const disk=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
const makeStore=()=>createProgressStore(data,context.window.XHS_PUBLISHED_PROGRESS,disk());

test('every priority Douyin candidate has a distinct saved homepage screenshot',()=>{
 const priority=douyin.filter(r=>r.screening==='优先候选');
 assert.equal(new Set(priority.map(r=>r.image)).size,priority.length);
 for(const row of priority){
  assert.match(row.image,/^assets\/profiles\/douyin-dy-\d+-20261009\.jpg$/);
  const bytes=fs.readFileSync(new URL('../public/'+row.image,import.meta.url));
  assert.ok(bytes.length>20000,row.uid+' screenshot must not be empty');
  assert.equal(bytes.readUInt16BE(0),0xffd8,row.uid+' must contain JPEG bytes');
  assert.match(row.note,/主页截图采集于 2026-10-09/);
  assert.equal(validateAccount(row).image,row.image);
 }
});

test('research candidates have distinct observed works, provenance and no outreach side effects',()=>{
 const candidates=filterPlatformAccounts(douyin),store=makeStore();
 assert.equal(candidates.length,60);assert.equal(douyin.length,80);
 assert.equal(new Set(douyin.map(r=>r.redId.toLowerCase())).size,douyin.length);
 assert.equal(store.trackedRows().length,57);
 for(const row of douyin){
  const validated=validateAccount(row);
  assert.equal(validated.verifiedAt,'2026-10-09');
  assert.match(validated.profile,/^https:\/\/www\.douyin\.com\/user\//);
  assert.equal(validated.sourceUrl,validated.profile);
  assert.ok(validated.reviewReason&&validated.reviewCaveat);
  assert.equal(store.get(row.order).status,'未建联');
  assert.equal(store.get(row.order).tracked,false);
  assert.equal(store.get(row.order).firstContactAt,'');
 }
 for(const row of candidates){
  assert.ok(row.example&&row.secondExample);
  for(const link of [row.caseUrl,row.secondCaseUrl])assert.match(link,/^https:\/\/www\.douyin\.com\/(video|note)\/\d+$/);
  assert.notEqual(row.caseUrl,row.secondCaseUrl);
 }
 assert.equal(data.filter(r=>(r.platform||'xhs')==='xhs').length,109);
 assert.equal(data.filter(r=>r.platform==='wechat').length,18);
});

test('filters distinguish exclusions, unknown followers, boundaries and representative works',()=>{
 const rows=[null,0,999,1000,9999,10000,30000,30001].map((fans,order)=>({fans,order,name:'边界',screening:'条件候选'}));
 assert.deepEqual(filterPlatformAccounts(rows,{fans:'small'}).map(r=>r.fans),[0,999]);
 assert.deepEqual(filterPlatformAccounts(rows,{fans:'koc'}).map(r=>r.fans),[1000,9999]);
 assert.deepEqual(filterPlatformAccounts(rows,{fans:'mid'}).map(r=>r.fans),[10000,30000]);
 assert.deepEqual(filterPlatformAccounts(rows,{fans:'unknown'}).map(r=>r.fans),[null]);
 assert.deepEqual(filterPlatformAccounts(rows,{fans:'large'}).map(r=>r.fans),[30001]);
 assert.equal(filterPlatformAccounts(douyin,{screening:'暂不纳入'}).length,20);
 assert.equal(filterPlatformAccounts(douyin,{screening:'all'}).length,80);
 assert.equal(filterPlatformAccounts(douyin,{screening:'优先候选'}).length,23);
 assert.ok(filterPlatformAccounts(douyin,{query:'zotero'}).some(r=>r.name==='冯叮当'));
 const one=douyin.find(r=>r.name==='Ai 陈自律');
 assert.deepEqual(filterPlatformAccounts(douyin,{group:'法律 × AI',selected:new Set([one.order])}).map(r=>r.order),[one.order]);
 assert.equal(filterPlatformAccounts(douyin,{query:'材料星'}).length,0);
 assert.equal(filterPlatformAccounts(douyin,{query:'材料星',screening:'all'}).length,1);
});

test('metadata edits and backup import preserve research and approximate counts without adding contact history',()=>{
 const store=makeStore(),row=douyin.find(r=>r.fansApprox);
 store.saveAccount({...row,reviewCaveat:'复核事项已补充',secondExample:'第二条作品摘要已补充'});
 const next=makeStore(),preview=next.previewImport(store.backup());
 next.importRecords(preview.records,preview.overrides);
 const restored=next.accounts().find(r=>r.order===row.order);
 for(const field of ['screening','secondCaseUrl','verifiedAt','sourceUrl'])assert.equal(restored[field],row[field]);
 assert.equal(restored.reviewCaveat,'复核事项已补充');
 assert.equal(restored.secondExample,'第二条作品摘要已补充');
 assert.equal(restored.fansApprox,true);assert.match(restored.fansRaw,/^约 /);
 assert.equal(next.get(row.order).status,'未建联');assert.equal(next.get(row.order).history.length,0);
 assert.equal(next.get(row.order).tracked,false);
 assert.throws(()=>validateAccount({...row,secondCaseUrl:'javascript:alert(1)'}),/链接/);
 assert.throws(()=>validateAccount({...row,screening:'已同意合作'}),/筛选结论/);
 assert.throws(()=>validateAccount({...row,fansApprox:'false'}),/粉丝口径/);
 const legacy={...row};for(const field of ['screening','secondExample','secondCaseUrl','reviewCaveat','fansApprox'])delete legacy[field];
 assert.equal(validateAccount(legacy).secondCaseUrl,'');
});

test('Excel carries homepage image bytes, two clickable works and approximate-follower basis beyond column Z',async t=>{
 const sandbox={window:{},setTimeout,clearTimeout,setImmediate,Uint8Array,ArrayBuffer,Buffer,Blob,Promise};
 vm.runInNewContext(fs.readFileSync(new URL('../public/assets/vendor/jszip.min.js',import.meta.url),'utf8'),sandbox);
 const JSZip=sandbox.window.JSZip;
 t.mock.method(globalThis,'fetch',async path=>{
  assert.match(path,/^assets\/profiles\/douyin-dy-\d+-20261009\.jpg$/);
  return new Response(fs.readFileSync(new URL('../public/'+path,import.meta.url)),{headers:{'content-type':'image/jpeg'}});
 });
 // Node has no browser bitmap decoder; the captured viewport is 1164 × 780.
 globalThis.createImageBitmap=async()=>({width:1164,height:780,close(){}});
 globalThis.window={JSZip};
 try{
  const exact=douyin.find(r=>r.name==='冯叮当'),approx=douyin.find(r=>r.fansApprox),store=makeStore();
  const blob=await exportAccountXlsx([exact,approx],r=>store.get(r),{});
  const zip=await JSZip.loadAsync(Buffer.from(await blob.arrayBuffer()));
  const sheet=await zip.file('xl/worksheets/sheet1.xml').async('string');
  const rels=await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string');
  assert.match(sheet,/<dimension ref="A1:AB5"/);
  assert.match(sheet,/<autoFilter ref="A3:AB5"/);
  assert.match(sheet,/第二条代表内容/);assert.match(sheet,/筛选复核事项/);
  assert.ok(sheet.includes(approx.reviewCaveat));
  assert.match(sheet,/<c r="E5" s="6"><v>\d+<\/v><\/c>/);
  assert.match(sheet,/<c r="AB5"[^>]*>.*页面以万显示，换算约数/);
  assert.ok(rels.includes(exact.secondCaseUrl));
  assert.match(sheet,/<hyperlink ref="AA4"/);
  assert.deepEqual(await zip.file('xl/media/profile1_0.jpg').async('nodebuffer'),fs.readFileSync(new URL('../public/'+exact.image,import.meta.url)));
  assert.ok(zip.file('xl/drawings/drawing1.xml'));
 }finally{delete globalThis.window;delete globalThis.createImageBitmap;}
});
