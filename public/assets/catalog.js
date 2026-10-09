export const PLATFORMS = {
 xhs:{name:'小红书',prefix:'XHS',idLabel:'小红书号'},
 wechat:{name:'微信公众号',prefix:'WX',idLabel:'公众号微信号'},
 douyin:{name:'抖音',prefix:'DY',idLabel:'抖音号'}
};
export const platformOf = row => row.platform || 'xhs';
export const codeOf = row => row.uid || 'XHS-'+String(row.order).padStart(3,'0');
export const identityText = row => row.redId || PLATFORMS[platformOf(row)].idLabel+'待核实';
export function copyAccounts(rows) {
 const mixed=new Set(rows.map(platformOf)).size>1;
 return rows.map(r=>(mixed?PLATFORMS[platformOf(r)].name+'\t':'')+r.name+'\t'+identityText(r)).join('\n');
}
export function safeUrl(value) {
 if(!value)return '';
 try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
function text(value,max,label){if(typeof value!=='string'||value.length>max)throw new Error(label+'格式不正确');return value.trim();}
export function validateAccount(input) {
 if(!input||!['wechat','douyin'].includes(input.platform)||!Number.isSafeInteger(input.order)||input.order<1000)throw new Error('新增账号的平台或编号不正确');
 const prefix=PLATFORMS[input.platform].prefix;
 if(typeof input.uid!=='string'||!new RegExp('^'+prefix+'-[A-Z0-9-]{3,40}$').test(input.uid))throw new Error('账号标识不正确');
 const r={order:input.order,platform:input.platform,uid:input.uid};
 for(const key of ['name','redId','group','category','team','contactPerson','reading'])r[key]=text(input[key]??'',160,key);
 if(!r.name)throw new Error('请填写账号名称');
 for(const key of ['reviewReason','contact','note','source','example','form'])r[key]=text(input[key]??'',2000,key);
 for(const key of ['profile','caseUrl','sourceUrl']){r[key]=text(input[key]??'',2000,key);if(r[key]&&!safeUrl(r[key]))throw new Error('链接需为完整的 http / https 地址');}
 for(const key of ['image','qrImage']){
  r[key]=text(input[key]??'',600000,key);
  if(r[key]&&!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(r[key])&&!/^assets\/profiles\/[\w.-]+\.(?:jpg|png|webp)$/.test(r[key]))throw new Error('图片请使用本机上传的 JPG、PNG 或 WebP');
 }
 r.fans=input.fans==null||input.fans===''?null:Number(input.fans);
 if(r.fans!==null&&(!Number.isSafeInteger(r.fans)||r.fans<0))throw new Error('粉丝量需为非负整数，未知请留空');
 r.fansRaw=r.fans===null?'待补充':r.fans.toLocaleString('zh-CN');
 r.verification=input.verification==='已核实'?'已核实':'待核实';
 r.verifiedAt=text(input.verifiedAt??'',10,'资料核对日期');
 if(r.verifiedAt&&(!/^\d{4}-\d{2}-\d{2}$/.test(r.verifiedAt)||!Number.isFinite(Date.parse(r.verifiedAt))||new Date(r.verifiedAt).toISOString().slice(0,10)!==r.verifiedAt))throw new Error('资料核对日期不正确');
 r.status=input.status==='未建联'?'未建联':'待核实';r.pool='候选';r.quote='';r.likes=null;r.likesRaw='待补充';
 return r;
}
export function mergeCatalog(base,overrides=[]) {
 if(!Array.isArray(overrides)||overrides.length>1000)throw new Error('账号资料过多或格式不正确');
 const rows=base.map(r=>({...r,platform:platformOf(r),uid:codeOf(r)})),seen=new Set();
 for(const input of overrides){
  const r=validateAccount(input);
  if(seen.has(r.order))throw new Error('账号资料存在重复编号');seen.add(r.order);
  const index=rows.findIndex(x=>x.order===r.order);
  if(index>=0&&(rows[index].uid!==r.uid||platformOf(rows[index])!==r.platform))throw new Error('账号编号与平台身份冲突');
  if(index<0)rows.push(r);else rows[index]=r;
 }
 const ids=new Set(),codes=new Set();
 for(const r of rows){
  if(codes.has(codeOf(r)))throw new Error('账号标识重复');codes.add(codeOf(r));
  if(r.redId){const identity=platformOf(r)+':'+r.redId.toLowerCase();if(ids.has(identity))throw new Error('同一平台已有此账号 ID，请核对后更新原账号');ids.add(identity);}
 }
 return rows;
}
