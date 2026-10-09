import fs from 'node:fs/promises';
import vm from 'node:vm';
import { validateBackup } from '../public/assets/progress-model.js';
import { mergeCatalog } from '../public/assets/catalog.js';
const input = process.argv[2];
if (!input) throw new Error('用法：node scripts/apply-progress.mjs <看板导出的进度备份.json>');
const context = {window:{}};
vm.runInNewContext(await fs.readFile(new URL('../public/assets/accounts.js',import.meta.url),'utf8'),context);
vm.runInNewContext(await fs.readFile(new URL('../public/assets/platform-data.js',import.meta.url),'utf8'),context);
const payload = JSON.parse(await fs.readFile(input,'utf8'));
const existingContext={window:{}};
vm.runInNewContext(await fs.readFile(new URL('../public/assets/progress.js',import.meta.url),'utf8'),existingContext);
const existing=existingContext.window.XHS_PUBLISHED_PROGRESS;
const accounts=[...new Map([...(existing.accounts??[]),...(payload.accounts??[])].map(r=>[r.order,r])).values()];
const catalog=mergeCatalog([...context.window.XHS_ACCOUNTS,...context.window.XHS_PLATFORM_ACCOUNTS],accounts);
const records = validateBackup(payload,catalog);
// Old XHS-only backups must not discard newer platform accounts or their progress.
const prior=validateBackup(existing,mergeCatalog([...context.window.XHS_ACCOUNTS,...context.window.XHS_PLATFORM_ACCOUNTS],existing.accounts??[]));
const merged=[...new Map([...prior,...records].map(r=>[r.order,r])).values()];
const output = {schema:'jev-xhs-progress',version:2,exportedAt:new Date().toISOString(),accounts,records:merged};
validateBackup(output,catalog);
const target = new URL('../public/assets/progress.js',import.meta.url);
// Retain the preceding shared version outside the website for recovery.
await fs.mkdir(new URL('../.local/',import.meta.url),{recursive:true});
await fs.copyFile(target,new URL('../.local/progress-before-'+Date.now()+'.js',import.meta.url));
await fs.writeFile(target,'window.XHS_PUBLISHED_PROGRESS='+JSON.stringify(output).replaceAll('<','\\u003c')+';\n');
console.log(`已更新 ${records.length} 个账号的发布数据；尚未提交或推送。`);
