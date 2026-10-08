import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createProgressStore,validateBackup,isDue,STORAGE_KEY} from '../public/assets/progress-model.js';
const context={window:{}};
vm.runInNewContext(fs.readFileSync(new URL('../public/assets/accounts.js',import.meta.url),'utf8'),context);
const data=JSON.parse(JSON.stringify(context.window.XHS_ACCOUNTS));
const empty={schema:'jev-xhs-progress',version:1,records:[]};
function storage(){const values=new Map();return{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};}

test('57 main accounts; verification dates never become actual contact times',()=>{
  const store=createProgressStore(data,empty,storage());
  assert.equal(store.trackedRows().length,57);
  assert.equal(store.get(6).status,'已回复，待跟进');
  assert.equal(store.get(6).firstContactAt,'');assert.equal(store.get(6).lastContactAt,'');
});
test('saving, reload and adding reserves retain history and identifiers',()=>{
  const disk=storage(),store=createProgressStore(data,empty,disk);
  store.save(6,{owner:'同事甲',firstContactAt:'2026-10-08T10:00',lastContactAt:'2026-10-08T11:00',nextFollowUpAt:'2026-10-09'},'发送资料');
  store.save(6,{status:'沟通中'},'收到回复');
  const restored=createProgressStore(data,empty,disk);
  assert.equal(restored.get(6).history.length,2);assert.equal(restored.get(6).owner,'同事甲');
  assert.equal(restored.get(6).redId,data.find(r=>r.order===6).redId);
  const reserve=data.find(r=>r.pool==='备选');store.save(reserve.order,{tracked:true},'加入追踪');assert.equal(store.trackedRows().length,58);
  assert.ok(disk.getItem(STORAGE_KEY));
});
test('invalid dates, identifier mismatches and duplicate IDs fail before mutation',()=>{
  const store=createProgressStore(data,empty,storage());
  assert.throws(()=>store.save(6,{lastContactAt:'2026-02-30T10:00'}));
  assert.throws(()=>store.save(6,{firstContactAt:'2026-10-09T10:00',lastContactAt:'2026-10-08T10:00'}));
  const payload=store.backup();payload.records[0].redId='wrong';assert.throws(()=>validateBackup(payload,data));
  const duplicate=store.backup();duplicate.records[1]=duplicate.records[0];assert.throws(()=>validateBackup(duplicate,data));
  assert.equal(store.draftCount(),0);
});
test('failed browser storage never reports or retains a successful edit',()=>{
  const store=createProgressStore(data,empty,{getItem:()=>null,setItem:()=>{throw new Error('quota');}});
  assert.throws(()=>store.save(6,{owner:'不应保存'}),/保存失败/);assert.equal(store.get(6).owner,'');
});
test('explicit import retains both collaborators histories',()=>{
  const a=createProgressStore(data,empty,storage()),b=createProgressStore(data,empty,storage());
  a.save(6,{owner:'甲'},'甲的记录');b.save(6,{owner:'乙'},'乙的记录');
  a.importRecords([b.get(6)]);assert.equal(a.get(6).owner,'乙');assert.equal(a.get(6).history.length,2);
  a.importRecords([b.get(6)]);assert.equal(a.get(6).history.length,2);
});
test('due work includes overdue and excludes completed or paused records',()=>{
  assert.equal(isDue({nextFollowUpAt:'2026-10-07',status:'沟通中'},'2026-10-08'),true);
  for(const status of ['已发布','暂停跟进','已婉拒，暂不合作'])assert.equal(isDue({nextFollowUpAt:'2026-10-08',status},'2026-10-08'),false);
});
