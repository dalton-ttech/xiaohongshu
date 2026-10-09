import {PLATFORMS,platformOf,codeOf} from './catalog.js';
import {initPlatformDirectory} from './platform-directory.js';
import {createProgressStore,isDue} from './progress-model.js';
import {initTracker} from './tracker.js';
import {exportAccountXlsx} from './xlsx-export.js';
const BASE_DATA=[...window.XHS_ACCOUNTS,...window.XHS_PLATFORM_ACCOUNTS];
let browserStorage;try{browserStorage=window.localStorage;}catch{}
const store=createProgressStore(BASE_DATA,window.XHS_PUBLISHED_PROGRESS,browserStorage);
const DATA=store.accounts();
let tracker,platformDirectory;
let activePlatform='xhs',activeBoard='directory';
const positions=new Map();
let savedView={};try{savedView=JSON.parse(localStorage.getItem('jev-workspace-view-v2')||'{}');}catch{}
let excelBusy=false;
const META=window.XHS_META;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let selected=new Set();try{selected=new Set(JSON.parse(localStorage.getItem('jev-xhs-public-selected-v1')||'[]').filter(id=>DATA.some(r=>r.order===id)));}catch{}
let group='all',visible=[],topLimit=0,previousSort='order';let toastTimer;
const counts=DATA.filter(r=>platformOf(r)==='xhs').reduce((o,r)=>(o[r.group]=(o[r.group]||0)+1,o),{});
$('outreachSnapshot').textContent='建联更新 '+META.outreachUpdatedAt.replaceAll('-','/');
$('totalStat').textContent=window.XHS_ACCOUNTS.length;$('newCount').textContent=DATA.filter(r=>r.addedBatch==='2026-10-04-main-expansion').length;
$('mainStat').textContent=window.XHS_ACCOUNTS.length-counts['备选'];$('reserveStat').textContent=counts['备选'];
document.querySelectorAll('[data-group]').forEach(b=>{b.textContent+=' '+(b.dataset.group==='all'?window.XHS_ACCOUNTS.length:(counts[b.dataset.group]||0));});
const mobileQuery=window.matchMedia('(max-width:700px)');
const updateFilterDisclosure=()=>{$('extraFilters').open=!mobileQuery.matches;};
updateFilterDisclosure();mobileQuery.addEventListener('change',updateFilterDisclosure);
const categories=[...new Set(window.XHS_ACCOUNTS.map(r=>r.category))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
$('category').innerHTML+='<option disabled>──────────</option>'+categories.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');
function toast(t){$('toast').textContent=t;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').textContent='',3200);}
function save(){try{localStorage.setItem('jev-xhs-public-selected-v1',JSON.stringify([...selected]));}catch{toast('当前浏览器无法保存勾选，请及时导出名单。');}}
function quote(r){return r.quote!==''?'¥ '+String(r.quote):'待询价';}
function card(r){return '<article class="card '+(selected.has(r.order)?'chosen':'')+'" data-order="'+r.order+'"><div class="card-head"><span class="number">'+String(r.order).padStart(3,'0')+'</span><div class="identity"><h2>'+esc(r.name)+'</h2><p>小红书号 '+esc(r.redId)+' · IP '+esc(r.ip)+'</p></div><label class="choose"><input type="checkbox" data-select="'+r.order+'" '+(selected.has(r.order)?'checked':'')+' aria-label="勾选 '+esc(r.name)+'">入选</label></div><button class="shot" data-preview="'+r.order+'" aria-label="放大 '+esc(r.name)+' 主页截图"><img src="'+r.image+'" alt="'+esc(r.name)+' 的小红书主页截图" loading="lazy" width="1240" height="750"><span class="zoom-label">截图 / 详情</span></button><div class="body"><div class="metrics"><div class="metric"><strong>'+esc(r.fansRaw)+'</strong><small>粉丝</small></div><div class="metric"><strong>'+esc(r.likesRaw)+'</strong><small>获赞与收藏</small></div></div><div class="tags"><span class="pool '+(r.pool==='备选'?'reserve':'')+'">'+esc(r.pool)+'</span><span class="tag '+(r.fieldGroup==='法律 × AI'?'legal':'')+'">'+esc(r.reviewKind)+'</span><span class="status '+(r.status.startsWith('已')?'contacted':'')+'">'+esc(r.status)+(r.followed?' · 已关注':'')+'</span>'+'</div><p class="review-reason" title="'+esc(r.reviewReason)+'">'+esc(r.reviewReason)+'</p><div class="detail-label">参考笔记</div><div class="example" title="'+esc(r.example)+'">'+esc(r.example)+'</div><div class="detail-label contact-label">建联线索</div><div class="contact" title="'+esc(r.contact)+'">'+esc(r.contact)+'</div><div class="deal"><span>报价：<b>'+esc(quote(r))+'</b></span><span>合作形式：<b>'+esc(r.form||'待沟通')+'</b></span></div></div><div class="card-footer"><a href="'+esc(r.profile)+'" target="_blank" rel="noopener noreferrer">小红书主页 ↗</a><a href="'+esc(r.caseUrl)+'" target="_blank" rel="noopener noreferrer">参考笔记 ↗</a></div></article>';}
function resetFilters(){
 topLimit=0;group='all';$('sort').value=previousSort;
 ['query','category','fans'].forEach(id=>$(id).value='');
 $('onlySelected').checked=false;$('onlyNew').checked=false;
 document.querySelectorAll('[data-top]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.top==='0')));
 document.querySelectorAll('[data-group]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.group==='all')));
 render();
}
function render(){
 const q=$('query').value.trim().toLowerCase(),cat=$('category').value,fan=$('fans').value;
 visible=DATA.filter(r=>platformOf(r)==='xhs'&&(group==='all'||r.group===group)&&(!$('onlyNew').checked||r.addedBatch==='2026-10-04-main-expansion')&&(!(topLimit&&group==='all')||r.pool==='主选')&&(!cat||r.category===cat)&&(!q||[r.name,r.category,r.example,r.emailStatus,r.redId,r.reviewKind,r.reviewReason,r.cooperationEvidence,r.status].join(' ').toLowerCase().includes(q))&&(!fan||(()=>{const[a,b]=fan.split('-').map(Number);return r.fans>=a&&r.fans<b;})())&&(!$('onlySelected').checked||selected.has(r.order)));
 const matched=visible.length,sort=topLimit?'fansDesc':$('sort').value;
 visible.sort((a,b)=>(sort==='fansDesc'?b.fans-a.fans:sort==='fansAsc'?a.fans-b.fans:sort==='likesDesc'?b.likes-a.likes:a.order-b.order)||a.order-b.order);
 if(topLimit)visible=visible.slice(0,topLimit);
 $('grid').innerHTML=visible.length?visible.map(card).join(''):'<div class="empty"><strong>没有符合条件的账号</strong><p>调整关键词，或清除筛选。</p><button data-reset type="button">重置筛选</button></div>';
 $('resultCount').innerHTML='显示 <b>'+visible.length+'</b> / '+matched+' 个符合条件的账号';
 $('rankHint').textContent=topLimit?(group==='备选'?'备选按粉丝量':'主选按粉丝量'):'完整账号池';
 $('selectionNote').textContent=group==='备选'?'备选：内容形式、个人定位或投稿限制需先确认。每个账号都附有理由，不代表拒绝合作。':topLimit?'Top 按主选账号的粉丝量排序，不代表合作成功率；不足指定数量时展示实际数量。':'AI · 学术、法律 AI 为主选；其余另列备选。按当前建联状态安排跟进，合作结果以进一步确认为准。';
 $('sort').disabled=Boolean(topLimit);
 updateCount();$('print').disabled=!visible.length;
}
document.querySelectorAll('[data-top]').forEach(b=>b.addEventListener('click',()=>{
 const next=Number(b.dataset.top);
 if(next&&!topLimit)previousSort=$('sort').value;
 topLimit=next;$('sort').value=next?'fansDesc':previousSort;
 document.querySelectorAll('[data-top]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
 render();window.scrollTo({top:0,behavior:'instant'});
}));
function updateCount(){const count=DATA.filter(r=>platformOf(r)==='xhs'&&selected.has(r.order)).length;$('selectedCount').textContent=count;$('export').disabled=!count;$('clear').disabled=!count;tracker?.render();platformDirectory?.render();}
document.querySelectorAll('[data-group]').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.group;document.querySelectorAll('[data-group]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
['query','category','fans','sort','onlySelected','onlyNew'].forEach(id=>$(id).addEventListener(id==='query'?'input':'change',render));
function handleSelection(e){
 if(!e.target.dataset.select)return;
 const id=Number(e.target.dataset.select);
 e.target.checked?selected.add(id):selected.delete(id);save();
 if($('onlySelected').checked)render();
 else{e.target.closest('[data-order]').classList.toggle('chosen',e.target.checked);updateCount();}
}
$('grid').addEventListener('change',handleSelection);
function showPreview(order){const r=DATA.find(x=>x.order===order);if(!r)return;if(platformOf(r)!=='xhs'){platformDirectory.preview(order);return;}$('previewFollowup').dataset.order=order;$('previewTitle').textContent=String(r.order).padStart(3,'0')+' · '+r.name;$('previewImage').src=r.image;$('previewImage').alt=r.name+' 的小红书主页截图';$('previewLink').href=r.profile;$('previewDetails').innerHTML='<div class="review-block '+(r.pool==='备选'?'reserve':'')+'"><p><b>'+esc(r.group)+' · '+esc(r.reviewKind)+'</b><br>'+esc(r.reviewReason)+'</p><p><b>公开线索</b>　'+esc(r.cooperationEvidence)+'</p></div><p><b>'+esc(r.fansRaw)+'</b> 粉丝　<b>'+esc(r.likesRaw)+'</b> 获赞与收藏</p><p>'+esc(r.category)+' · 小红书号 '+esc(r.redId)+' · IP '+esc(r.ip)+'</p><p><b>参考笔记</b><br><a href="'+esc(r.caseUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(r.example)+' ↗</a></p><p><b>建联线索</b><br>'+esc(r.contact)+'</p><p>建联：'+esc(r.status)+(r.statusVerifiedAt?'<br>状态核对：'+esc(r.statusVerifiedAt):'')+'<br>报价：'+esc(quote(r))+'<br>合作形式：'+esc(r.form||'待沟通')+'</p>';$('preview').showModal();}
function handleListClick(e){const b=e.target.closest('[data-preview]'),followup=e.target.closest('[data-followup]');if(b)showPreview(Number(b.dataset.preview));if(followup)tracker.openEditor(Number(followup.dataset.followup));if(e.target.closest('[data-reset]'))resetFilters();}
$('grid').addEventListener('click',handleListClick);
$('closePreview').addEventListener('click',()=>$('preview').close());$('preview').addEventListener('click',e=>{if(e.target===$('preview')){const r=$('preview').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('preview').close();}});
$('clear').addEventListener('click',()=>{DATA.filter(r=>platformOf(r)==='xhs').forEach(r=>selected.delete(r.order));save();render();toast('已清空小红书勾选。');});
$('export').addEventListener('click',()=>{const rows=DATA.filter(r=>platformOf(r)==='xhs'&&selected.has(r.order));if(!rows.length)return;const values=[['序号','账号名称','粉丝量（主页展示）','获赞与收藏（主页展示）','内容方向','是否已建联','报价（元/条）','合作形式','主页链接','参考笔记','案例链接','候选分组','筛选理由','公开合作线索','状态核对日期'],...rows.map(r=>[r.order,r.name,r.fansRaw,r.likesRaw,r.category,r.status,r.quote,r.form,r.profile,r.example,r.caseUrl,r.group,r.reviewReason,r.cooperationEvidence,r.statusVerifiedAt||''])];const cell=v=>{let s=String(v??'');if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};const csv='\ufeff'+values.map(row=>row.map(cell).join(',')).join('\r\n');const a=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='JEV_已选'+rows.length+'个账号.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('已导出 '+rows.length+' 个勾选账号。');});
function printCard(r){return '<article class="print-card"><div class="print-name"><div><h2>'+esc(r.name)+'</h2><p>'+esc(r.category)+' · 小红书号 '+esc(r.redId)+' · IP '+esc(r.ip)+'</p></div><span class="print-number">'+String(r.order).padStart(3,'0')+'</span></div><img class="print-img" src="'+r.image+'" alt="'+esc(r.name)+' 主页"><div class="print-metrics"><span><strong>'+esc(r.fansRaw)+'</strong> 粉丝</span><span><strong>'+esc(r.likesRaw)+'</strong> 获赞与收藏</span></div><div class="print-review"><b>'+esc(r.group)+' · '+esc(r.reviewKind)+'</b><br>'+esc(r.reviewReason)+'</div><div class="print-details"><p class="print-case"><b>参考笔记</b>　'+esc(r.example)+'</p><p class="print-contact"><b>建联线索</b>　'+esc(r.contact)+'</p><p><b>建联</b> '+esc(r.status)+'　<b>报价</b> '+esc(quote(r))+'　<b>形式</b> '+esc(r.form||'待沟通')+'</p>'+'</div><div class="print-links"><span>□ 纳入询价　□ 备选　□ 暂不考虑</span><span><a href="'+esc(r.profile)+'">主页 ↗</a>　<a href="'+esc(r.caseUrl)+'">笔记 ↗</a></span></div></article>';}
window.preparePrint=function(){const pages=[];for(let i=0;i<visible.length;i+=2){pages.push('<section class="print-page"><div class="print-heading"><strong>JEV 论文推广 · 小红书账号池</strong><span>主页 '+esc(META.profilesSnapshot.slice(5))+' · 建联 '+esc(META.outreachUpdatedAt.slice(5))+' · 当前筛选 '+visible.length+' 个账号</span></div><div class="print-pair">'+visible.slice(i,i+2).map(printCard).join('')+'</div><div class="print-footer"><span>主选及备选均待确认合作 · 依据公开内容筛选 · 编号对应 Excel</span><span>'+Math.floor(i/2+1)+' / '+Math.ceil(visible.length/2)+'</span></div></section>');}$('paperSheets').innerHTML=pages.join('')||'<p class="print-empty">当前没有符合条件的账号。</p>';};
$('print').addEventListener('click',async()=>{window.preparePrint();await Promise.all([...$('paperSheets').querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));window.print();});window.addEventListener('beforeprint',window.preparePrint);
render();

function download(content,filename,type){
 const url=URL.createObjectURL(content instanceof Blob?content:new Blob([content],{type}));
 const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function copyText(text){
 if(!text){toast('请先勾选账号。');return;}
 try{await navigator.clipboard.writeText(text);toast('已复制 '+text.split('\n').length+' 行账号信息。');}
 catch{$('copyText').value=text;$('copyFallback').showModal();$('copyText').focus();$('copyText').select();}
}
async function exportExcel(rows,button){
 if(!rows.length)return;
 if(excelBusy){toast('正在准备 Excel，请稍候。');return;}
 excelBusy=true;
 const label=button.textContent;button.disabled=true;
 try{const blob=await exportAccountXlsx(rows,order=>store.get(order),META,(done,total)=>button.textContent='准备截图 '+done+' / '+total);download(blob,'JEV_选中'+rows.length+'个账号.xlsx');toast('已按平台导出 Excel；已提供的截图一并保留。');}
 catch(error){toast('导出失败：'+error.message);}
 finally{excelBusy=false;button.textContent=label;updateCount();}
}
$('closeCopy').addEventListener('click',()=>$('copyFallback').close());
$('previewFollowup').addEventListener('click',()=>{$('preview').close();tracker.openEditor(Number($('previewFollowup').dataset.order));});
const platform=()=>activePlatform;
tracker=initTracker({data:DATA,store,selected,platform,saveSelection:save,selectionChanged:render,preview:showPreview,copy:copyText,exportExcel,isExporting:()=>excelBusy,download,toast,esc});
platformDirectory=initPlatformDirectory({data:DATA,store,selected,platform,saveSelection:save,selectionChanged:render,editProgress:order=>tracker.openEditor(order),copy:copyText,exportExcel,isExporting:()=>excelBusy,toast,esc});
function syncProgress(){
 DATA.splice(0,DATA.length,...store.accounts());
 for(const row of DATA)row.status=store.get(row.order).status;
 for(const [key,id] of Object.entries({xhs:'countXhs',wechat:'countWechat',douyin:'countDouyin'}))$(id).textContent=DATA.filter(r=>platformOf(r)===key).length;
 $('todayCount').textContent=store.trackedRows().filter(r=>isDue(store.get(r.order))).length;
 $('navTrackedCount').textContent=store.trackedRows().filter(r=>activePlatform==='all'||platformOf(r)===activePlatform).length;
 $('navPoolCount').textContent=DATA.filter(r=>activePlatform==='all'||platformOf(r)===activePlatform).length;
 render();
}
store.subscribe(syncProgress);syncProgress();
function switchWorkspace(nextPlatform,nextBoard,restore=true){
 positions.set(activePlatform+'/'+activeBoard,window.scrollY);
 if(nextPlatform==='all'&&nextBoard==='directory')nextPlatform='xhs';
 activePlatform=nextPlatform;activeBoard=nextBoard;
 $('directoryPanel').hidden=activeBoard!=='directory'||activePlatform!=='xhs';
 $('platformDirectory').hidden=activeBoard!=='directory'||activePlatform==='xhs';
 $('trackerPanel').hidden=activeBoard!=='tracker';$('rankNav').hidden=activeBoard!=='directory'||activePlatform!=='xhs';
 document.querySelectorAll('[data-board]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.board===activeBoard)));
 document.querySelectorAll('[data-platform]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.platform===activePlatform));if(b.dataset.platform==='all')b.hidden=activeBoard!=='tracker';});
 tracker.setPlatform(activePlatform);platformDirectory.setPlatform(activePlatform);syncProgress();
 const hash='#'+(activePlatform==='xhs'?'':activePlatform+'/')+activeBoard;
 if(location.hash!==hash)history.replaceState(null,'',hash);
 try{localStorage.setItem('jev-workspace-view-v2',JSON.stringify({platform:activePlatform,board:activeBoard}));}catch{}
 window.scrollTo({top:restore?(positions.get(activePlatform+'/'+activeBoard)||0):0,behavior:'instant'});
}
function readRoute(){const parts=location.hash.slice(1).split('/');return {platform:parts.length===2&&[...Object.keys(PLATFORMS),'all'].includes(parts[0])?parts[0]:'xhs',board:parts.at(-1)==='tracker'?'tracker':'directory'};}
document.querySelectorAll('[data-board]').forEach(b=>b.addEventListener('click',()=>switchWorkspace(activePlatform,b.dataset.board)));
document.querySelectorAll('[data-platform]').forEach(b=>b.addEventListener('click',()=>switchWorkspace(b.dataset.platform,activeBoard)));
$('todayWork').addEventListener('click',()=>{switchWorkspace('all','tracker',false);tracker.showDue();});
window.addEventListener('hashchange',()=>{const route=readRoute();switchWorkspace(route.platform,route.board);});
const initial=location.hash?readRoute():{platform:Object.hasOwn(PLATFORMS,savedView.platform)||savedView.platform==='all'?savedView.platform:'xhs',board:savedView.board==='tracker'?'tracker':'directory'};
switchWorkspace(initial.platform,initial.board);
if(store.loadWarning)toast(store.loadWarning);
