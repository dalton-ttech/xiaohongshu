import fs from 'node:fs/promises';
import vm from 'node:vm';
import { validateBackup } from '../public/assets/progress-model.js';
const input = process.argv[2];
if (!input) throw new Error('用法：node scripts/apply-progress.mjs <看板导出的进度备份.json>');
const context = {window:{}};
vm.runInNewContext(await fs.readFile(new URL('../public/assets/accounts.js',import.meta.url),'utf8'),context);
const payload = JSON.parse(await fs.readFile(input,'utf8'));
const records = validateBackup(payload,context.window.XHS_ACCOUNTS);
const output = {schema:'jev-xhs-progress',version:1,exportedAt:new Date().toISOString(),records};
const target = new URL('../public/assets/progress.js',import.meta.url);
// Retain the preceding shared version outside the website for recovery.
await fs.mkdir(new URL('../.local/',import.meta.url),{recursive:true});
await fs.copyFile(target,new URL('../.local/progress-before-'+Date.now()+'.js',import.meta.url));
await fs.writeFile(target,'window.XHS_PUBLISHED_PROGRESS='+JSON.stringify(output).replaceAll('<','\\u003c')+';\n');
console.log(`已更新 ${records.length} 个账号的发布数据；尚未提交或推送。`);
