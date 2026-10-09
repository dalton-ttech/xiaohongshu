import {PLATFORMS,platformOf,codeOf,identityText,copyAccounts,safeUrl} from './catalog.js';
import { STATUSES, CHANNELS, isMain, isDue, stageOfStatus, shanghaiToday, sameValue } from './progress-model.js';

export function initTracker({ data, store, selected, platform, saveSelection, selectionChanged, preview, copy, exportExcel, isExporting, download, toast, esc }) {
  const $ = id => document.getElementById(id);
  let visible=[], stage='all', editing=null, importCandidates=[],incomingCatalog=[],incomingOverrides=[],currentPlatform='xhs',batchOrders=[];const filters=new Map();
  const scope=()=>store.trackedRows().filter(r=>platform()==='all'||platformOf(r)===platform());
  const stages=[['all','全部追踪'],['unverified','待核实'],['uncontacted','未建联'],['waiting','待回复'],['replied','已回复 / 沟通中'],['due','今日待跟进'],['blocked','发送异常'],['completed','已确认 / 已发布'],['declined','暂停 / 不合作']];
  $('trackerPanel').innerHTML=`
    <div class="tracker-heading"><div><div class="eyebrow">OUTREACH / DAILY WORKSPACE</div><h1>建联追踪</h1><p id="trackerIntro">分配负责人，记录实际发送，再安排下一次跟进。</p></div><span class="tracker-scope" id="trackerScope"></span></div>
    <div id="trackerStages" class="tracker-stages" role="group" aria-label="追踪状态"></div>
    <div class="tracker-notice"><span id="draftNotice" aria-live="polite"></span><span>本机编辑不会自动同步给同事</span></div>
    <div class="tracker-filters"><label class="tracker-search"><span class="sr-only">搜索追踪账号</span><input id="trackerQuery" type="search" placeholder="搜索名称、账号 ID、编号、备注…"></label><select id="trackerGroup" aria-label="追踪领域"><option value="">全部领域</option><option>AI / 学术</option><option>法律 × AI</option></select><select id="trackerOwner" aria-label="负责人"><option value="">全部负责人</option></select><select id="trackerSort" aria-label="追踪排序"><option value="order">按编号</option><option value="next">下次跟进：由近到远</option><option value="latest">最近跟进：由近到远</option><option value="fans">粉丝量：高到低</option></select><label class="checkline"><input type="checkbox" id="trackerOnlySelected">只看勾选 <b id="trackerSelectedCount">0</b></label><button type="button" id="trackerReset">重置筛选</button></div>
    <div class="tracker-actions"><div><button type="button" id="trackerSelectVisible">勾选当前结果</button><button type="button" id="trackerClear">清空追踪勾选</button><button type="button" id="trackerAssign">分配负责人</button><button type="button" id="trackerSent">记录已发送</button><button type="button" id="trackerCopy">复制账号信息</button><button type="button" id="trackerExcel" class="primary">导出 Excel · 含已有截图</button></div><details class="backup-tools"><summary>进度备份 / 导入</summary><div><button type="button" id="trackerBackup">备份全部进度 JSON</button><button type="button" id="trackerImport">导入进度 JSON</button><input type="file" id="progressFile" accept=".json,application/json" hidden></div><p>修改仅保存在当前浏览器，请及时备份。将备份交给维护者更新发布数据后，同事才能在网站看到。导入前会预览差异，Excel 用于执行与反馈，不自动回写。</p></details></div>
    <div class="tracker-result"><span id="trackerResult" aria-live="polite"></span><span>时间为北京时间 · 空白表示待补充 · 已回复不等于已确认合作</span></div>
    <p class="table-scroll-hint">左右滑动查看负责人、时间和操作 →</p>
    <div class="tracker-table-wrap"><table class="tracker-table"><caption class="sr-only">建联账号、负责人、时间与状态</caption><thead><tr><th scope="col">编号 / 账号</th><th scope="col">平台账号 ID</th><th scope="col">粉丝</th><th scope="col">负责人</th><th scope="col">状态</th><th scope="col">实际建联 / 跟进时间</th><th scope="col">下次跟进</th><th scope="col">操作</th></tr></thead><tbody id="trackerBody"></tbody></table><div id="trackerEmpty" class="empty" hidden><strong>没有符合条件的追踪账号</strong><p>可以调整状态、负责人或关键词。</p><button type="button" data-tracker-reset>重置筛选</button></div></div>`;
  document.body.insertAdjacentHTML('beforeend',`
    <dialog id="progressEditor" class="progress-editor detail-drawer" aria-labelledby="editorTitle"><form id="progressForm"><div class="dialog-head"><div><h2 id="editorTitle"></h2><p id="editorIdentity"></p></div><button type="button" id="closeEditor">关闭 ✕</button></div><div class="editor-body"><p class="editor-storage">记录保存到本机；备份并更新发布数据后，同事才能看到。</p><div class="editor-fields"><label>负责人<input id="editOwner" maxlength="80" list="ownerSuggestions" placeholder="填写姓名或分工名称"><datalist id="ownerSuggestions"></datalist></label><label>当前状态<select id="editStatus">${STATUSES.map(s=>`<option>${esc(s)}</option>`).join('')}</select></label><label>首次实际建联时间<select id="editFirstPrecision" aria-label="首次时间精度"><option value="datetime-local">日期和时间</option><option value="date">仅日期</option></select><input id="editFirst" type="datetime-local"><small>不确定请留空，不用核对日期替代</small></label><label>最近实际跟进时间<select id="editLastPrecision" aria-label="最近时间精度"><option value="datetime-local">日期和时间</option><option value="date">仅日期</option></select><input id="editLast" type="datetime-local"><small>填写实际私信、回复或跟进发生的时间</small></label><label>联系渠道<select id="editChannel">${CHANNELS.map(c=>`<option value="${c}">${c||"待补充"}</option>`).join('')}</select></label><label>下次跟进日期<input id="editNext" type="date"></label><label class="editor-wide">账号备注<textarea id="editNote" maxlength="2000" rows="2" placeholder="当前需要注意的事项"></textarea></label><label class="editor-wide">本次记录<textarea id="editMessage" maxlength="2000" rows="2" placeholder="例如：已发送论文链接，等待对方看完回复"></textarea></label></div><p id="editorError" class="form-error" role="alert"></p><div class="editor-submit"><span id="editorSource"></span><button type="submit" class="primary">保存本机进度</button></div><section class="history-section" aria-labelledby="historyTitle"><h3 id="historyTitle">跟进记录</h3><ol id="editorHistory"></ol></section></div></form></dialog>
    <dialog id="importPreview" class="import-preview" aria-labelledby="importTitle"><div class="dialog-head"><div><h2 id="importTitle">预览导入差异</h2><p>相同编号与小红书号才会匹配；只导入勾选项。</p></div><button type="button" id="cancelImport">取消</button></div><div class="editor-body"><p>已有记录发生变化的项目默认不勾选，请核对时间后决定；双方历史记录会合并保留。</p><div id="importRows"></div><p id="importError" class="form-error" role="alert"></p><button type="button" class="primary" id="confirmImport">导入勾选记录</button></div></dialog>`);
  function formatDate(value) { return value ? value.replace('T',' ') : '待补充'; }
  function formatSaved(value) { return value ? new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(value)) : '无修改记录'; }
  function accountDifference(incoming){
    const current=store.accounts().find(r=>r.order===incoming.order)||{};
    return Object.entries({name:'名称',redId:'平台账号 ID',fans:'粉丝量',group:'内容方向',team:'团队 / 别名',profile:'主页',caseUrl:'代表内容链接',example:'代表内容',reading:'阅读 / 播放',contact:'建联入口',contactPerson:'联系人',reviewReason:'推荐理由',note:'账号备注',source:'来源',sourceUrl:'来源链接',verification:'核实状态',verifiedAt:'核实日期',image:'截图',qrImage:'二维码'}).filter(([key])=>!sameValue(current[key]??'',incoming[key]??'')).map(([key,label])=>`<small>${label}：${['image','qrImage'].includes(key)?`${current[key]?'有图片':'无图片'} → ${incoming[key]?'采用导入图片':'无图片'}`:`${esc(current[key]??'待补充')||'待补充'} → ${esc(incoming[key]??'待补充')||'待补充'}`}</small>`).join('');
  }
  function matchesStage(record,key) { return key==='all' || (key==='due' ? isDue(record) : stageOfStatus(record.status)===key); }
  function selectedRows() { return scope().filter(row=>selected.has(row.order)); }
  function updateSelection() {
    const count=selectedRows().length;
    $('trackerSelectedCount').textContent=count;$('trackerAssign').textContent='分配负责人'+(count?' · '+count:'');$('trackerSent').textContent='记录已发送'+(count?' · '+count:'');
    for(const id of ['trackerClear','trackerCopy','trackerExcel','trackerAssign','trackerSent']){$(id).disabled=!count;$(id).hidden=!count;}
    $('trackerExcel').disabled=!count||isExporting();
  }
  function render() {
    const rows=scope();
    $('trackerScope').textContent=`${platform()==='all'?'全部平台':PLATFORMS[platform()].name} · ${rows.length} 个追踪`;
    $('trackerIntro').textContent=platform()==='xhs'?'57 个主选默认追踪；备选可从账号池加入。分配与发送分别记录。':'从账号池选中候选加入追踪；待核实资料不代表已完成建联。';
    if(!$('trackerStages').children.length)$('trackerStages').innerHTML=stages.map(([key,label])=>`<button type="button" data-tracker-stage="${key}" aria-pressed="false"><span>${label}</span><b></b></button>`).join('');
    for(const b of $('trackerStages').children){b.setAttribute('aria-pressed',String(b.dataset.trackerStage===stage));b.querySelector('b').textContent=rows.filter(r=>matchesStage(store.get(r.order),b.dataset.trackerStage)).length;}
    const draftCount=store.draftCount();
    $('draftNotice').textContent=draftCount?`${draftCount} 个账号有本机修改 · 请备份后交由维护者更新网站`:'当前显示已发布资料与已保存的本机进度';
    const previousOwner=$('trackerOwner').value;
    const owners=[...new Set(rows.map(r=>store.get(r.order).owner).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
    $('trackerOwner').innerHTML='<option value="">全部负责人</option><option value="__unassigned">未分配</option>'+owners.map(owner=>`<option value="${esc(owner)}">${esc(owner)}</option>`).join('');
    if([...$('trackerOwner').options].some(o=>o.value===previousOwner))$('trackerOwner').value=previousOwner;
    $('ownerSuggestions').innerHTML=owners.map(owner=>`<option value="${esc(owner)}"></option>`).join('');
    const oldGroup=$('trackerGroup').value;$('trackerGroup').innerHTML='<option value="">全部领域</option>'+[...new Set(rows.map(r=>r.fieldGroup||r.group))].map(g=>`<option>${esc(g)}</option>`).join('');$('trackerGroup').value=oldGroup;
    const query=$('trackerQuery').value.trim().toLowerCase(),group=$('trackerGroup').value,owner=$('trackerOwner').value;
    visible=rows.filter(r=>{const p=store.get(r.order);return matchesStage(p,stage)&&(!group||(r.fieldGroup||r.group)===group)&&(!owner||(owner==='__unassigned'?!p.owner:p.owner===owner))&&(!$('trackerOnlySelected').checked||selected.has(r.order))&&(!query||[codeOf(r),r.name,r.redId,p.owner,p.note,p.status].join(' ').toLowerCase().includes(query));});
    const sort=$('trackerSort').value;
    visible.sort((a,b)=>{const pa=store.get(a.order),pb=store.get(b.order);return (sort==='fans'?(b.fans??-1)-(a.fans??-1):sort==='next'?(pa.nextFollowUpAt||'9999').localeCompare(pb.nextFollowUpAt||'9999'):sort==='latest'?(pb.lastContactAt||'').localeCompare(pa.lastContactAt||''):a.order-b.order)||a.order-b.order;});
    $('trackerBody').innerHTML=visible.map(r=>{const p=store.get(r.order);return `<tr data-order="${r.order}" class="${selected.has(r.order)?'chosen':''}"><td><div class="tracker-identity"><label class="table-choose"><input type="checkbox" data-tracker-select="${r.order}" ${selected.has(r.order)?'checked':''} aria-label="勾选 ${esc(r.name)}"><span>${esc(codeOf(r))}</span></label><div><button class="account-name" type="button" data-tracker-preview="${r.order}">${esc(r.name)}</button><small>${platform()==='all'?PLATFORMS[platformOf(r)].name+' · ':''}${esc(r.group)}${store.isDraft(r.order)?' · 本机修改':''}</small></div></div></td><td><span class="red-id">${esc(identityText(r))}</span><button class="inline-copy" type="button" data-copy-one="${r.order}" aria-label="复制 ${esc(r.name)} 账号信息">复制</button></td><td><strong>${esc(r.fansRaw)}</strong></td><td>${esc(p.owner)||'<span class="muted">未分配</span>'}</td><td><span class="outreach-status ${stageOfStatus(p.status)}">${esc(p.status)}</span>${p.channel?`<small>${esc(p.channel)}</small>`:''}${r.statusVerifiedAt?`<small>资料核对 ${esc(r.statusVerifiedAt)}</small>`:''}</td><td><span>${esc(formatDate(p.lastContactAt))}</span><small>首次 ${esc(formatDate(p.firstContactAt))}</small></td><td class="${isDue(p)?'due-date':''}">${esc(p.nextFollowUpAt)||'<span class="muted">未安排</span>'}${isDue(p)?'<small>今日需跟进</small>':''}</td><td><div class="tracker-row-actions"><button type="button" data-edit-progress="${r.order}">记录 / 历史</button>${safeUrl(r.profile)?`<a href="${esc(safeUrl(r.profile))}" target="_blank" rel="noopener noreferrer">主页 ↗</a>`:''}</div></td></tr>`;}).join('');
    $('trackerEmpty').hidden=Boolean(visible.length);
    $('trackerResult').textContent=`显示 ${visible.length} / ${rows.length} 个追踪账号 · 勾选跨筛选保留`;
    $('trackerSelectVisible').disabled=!visible.length; updateSelection();
  }
  function reset() {stage='all';['trackerQuery','trackerGroup','trackerOwner'].forEach(id=>$(id).value='');$('trackerSort').value='order';$('trackerOnlySelected').checked=false;render();}
  function openEditor(order) {
    const r=data.find(r=>r.order===order);if(!r)return;
    editing=order;const p=store.get(order);
    $('editorTitle').textContent=`${codeOf(r)} · ${r.name}`;
    $('editorIdentity').textContent=`${PLATFORMS[platformOf(r)].idLabel} ${identityText(r)} · ${r.fansRaw} 粉丝`;
    for(const [id,key]of [['editFirst','firstContactAt'],['editLast','lastContactAt']]){$(id).type=p[key].length===10?'date':'datetime-local';$(id+'Precision').value=$(id).type;}
    for(const [id,key] of Object.entries({editChannel:'channel',editOwner:'owner',editStatus:'status',editFirst:'firstContactAt',editLast:'lastContactAt',editNext:'nextFollowUpAt',editNote:'note'}))$(id).value=p[key];
    $('editMessage').value='';$('editorError').textContent='';
    $('editorSource').textContent=!p.tracked?'保存后将此备选加入追踪':store.isDraft(order)?'此账号有本机修改':'此账号使用已发布资料';
    const initial=`<li><strong>初始资料：${esc(store.initialStatus(order))}</strong><p>${r.statusVerifiedAt?'资料核对于 '+esc(r.statusVerifiedAt)+'；':'暂无核对日期；'}实际建联时间需另行补充。</p></li>`;
    $('editorHistory').innerHTML=initial+p.history.slice().reverse().map(h=>`<li><strong>${esc(h.message)}</strong><p>${esc(h.status)}${h.channel?' · '+esc(h.channel):''} · ${esc(h.owner)||'未分配负责人'}</p><p>最近实际跟进：${esc(formatDate(h.lastContactAt))}</p><small>记录保存：${esc(formatSaved(h.loggedAt))}</small>${h.note?`<p>${esc(h.note)}</p>`:''}</li>`).join('');
    $('progressEditor').showModal();
  }
  $('progressForm').addEventListener('submit',e=>{
    e.preventDefault();
    try {
      store.save(editing,{tracked:true,channel:$('editChannel').value,owner:$('editOwner').value,status:$('editStatus').value,firstContactAt:$('editFirst').value,lastContactAt:$('editLast').value,nextFollowUpAt:$('editNext').value,note:$('editNote').value},$('editMessage').value);
      $('progressEditor').close();toast('已保存到本机，请及时备份进度。');
    }catch(error){$('editorError').textContent=error.message;}
  });
  $('closeEditor').addEventListener('click',()=>$('progressEditor').close());
  $('trackerStages').addEventListener('click',e=>{const b=e.target.closest('[data-tracker-stage]');if(b){stage=b.dataset.trackerStage;render();}});
  for(const id of ['trackerQuery','trackerGroup','trackerOwner','trackerSort','trackerOnlySelected'])$(id).addEventListener(id==='trackerQuery'?'input':'change',render);
  $('trackerReset').addEventListener('click',reset);
  $('trackerEmpty').addEventListener('click',e=>{if(e.target.closest('[data-tracker-reset]'))reset();});
  $('trackerBody').addEventListener('change',e=>{const id=Number(e.target.dataset.trackerSelect);if(!id)return;e.target.checked?selected.add(id):selected.delete(id);saveSelection();selectionChanged();if($('trackerOnlySelected').checked)render();else{e.target.closest('tr').classList.toggle('chosen',e.target.checked);updateSelection();}});
  $('trackerBody').addEventListener('click',e=>{const edit=e.target.closest('[data-edit-progress]'),shot=e.target.closest('[data-tracker-preview]'),one=e.target.closest('[data-copy-one]');if(edit)openEditor(Number(edit.dataset.editProgress));if(shot)preview(Number(shot.dataset.trackerPreview));if(one){const r=data.find(r=>r.order===Number(one.dataset.copyOne));copy(copyAccounts([r]));}});
  $('trackerSelectVisible').addEventListener('click',()=>{visible.forEach(r=>selected.add(r.order));saveSelection();selectionChanged();render();});
  $('trackerClear').addEventListener('click',()=>{scope().forEach(r=>selected.delete(r.order));saveSelection();selectionChanged();render();});
  $('trackerCopy').addEventListener('click',()=>copy(copyAccounts(selectedRows())));
  $('trackerExcel').addEventListener('click',()=>exportExcel(selectedRows(),$('trackerExcel')));
  $('trackerBackup').addEventListener('click',()=>{download(JSON.stringify(store.backup(),null,2),`JEV_建联进度_${shanghaiToday()}.json`,'application/json');toast('已导出完整进度备份；备份不会自动更新网站。');});
  $('trackerImport').addEventListener('click',()=>$('progressFile').click());
  $('progressFile').addEventListener('change',async()=>{
    const file=$('progressFile').files[0];$('progressFile').value='';if(!file)return;
    try {
      if(file.size>20*1024*1024)throw new Error('进度文件超过 20MB，请检查文件');
      const bundle=store.previewImport(JSON.parse(await file.text()));incomingCatalog=bundle.accounts;incomingOverrides=bundle.overrides;
      const records=bundle.records;
      importCandidates=records.filter(r=>!data.some(a=>a.order===r.order)||!sameValue(store.get(r.order),r)||!sameValue(store.accounts().find(a=>a.order===r.order),incomingCatalog.find(a=>a.order===r.order)));
      $('importError').textContent='';
      $('importRows').innerHTML=importCandidates.length?importCandidates.map((incoming,i)=>{const r=incomingCatalog.find(r=>r.order===incoming.order),exists=data.some(a=>a.order===r.order),current=exists?store.get(r.order):{status:'尚未收录',history:[]},conflict=exists&&Boolean(current.updatedAt||current.history.length||incomingOverrides.some(a=>a.order===r.order));return `<label class="import-row"><input type="checkbox" data-import-index="${i}" ${conflict?'':'checked'}><span><strong>${esc(codeOf(r))} · ${esc(r.name)}${conflict?' · 需核对':''}</strong><small>账号资料：${esc(PLATFORMS[platformOf(r)].name)} · ${esc(identityText(r))} · ${esc(r.group)}${incomingOverrides.some(a=>a.order===r.order)?' · 将采用导入的账号资料（含来源、联系人、图片）':''}</small>${incomingOverrides.some(a=>a.order===r.order)?accountDifference(r):''}<small>当前：${esc(current.status)} / ${esc(current.owner)||'未分配'} / 保存 ${esc(formatSaved(current.updatedAt))}</small><small>导入：${esc(incoming.status)} / ${esc(incoming.owner)||'未分配'} / 保存 ${esc(formatSaved(incoming.updatedAt))}</small><small>首次建联 ${esc(formatDate(current.firstContactAt))} → ${esc(formatDate(incoming.firstContactAt))}</small><small>最近跟进 ${esc(formatDate(current.lastContactAt))} → ${esc(formatDate(incoming.lastContactAt))}</small><small>下次跟进 ${esc(current.nextFollowUpAt)||"未安排"} → ${esc(incoming.nextFollowUpAt)||"未安排"}</small><small>当前备注：${esc(current.note)||"无"}</small><small>导入备注：${esc(incoming.note)||"无"} · 导入历史 ${incoming.history.length} 条</small></span></label>`;}).join(''):'<p>没有变化，当前记录与导入文件一致。</p>';
      $('confirmImport').disabled=!importCandidates.length;$('importPreview').showModal();
    }catch(error){toast('导入失败：'+error.message);}
  });
  $('cancelImport').addEventListener('click',()=>$('importPreview').close());
  $('confirmImport').addEventListener('click',()=>{
    const records=[...$('importRows').querySelectorAll('input:checked')].map(input=>importCandidates[Number(input.dataset.importIndex)]);
    if(!records.length){$('importError').textContent='请勾选要导入的记录，或取消导入。';return;}
    try{store.importRecords(records,incomingOverrides);$('importPreview').close();toast(`已导入 ${records.length} 个账号，双方历史记录已保留。`);}catch(error){$('importError').textContent=error.message;}
  });

  document.body.insertAdjacentHTML('beforeend',`<dialog id="batchEditor" class="progress-editor" aria-labelledby="batchTitle"><form id="batchForm"><div class="dialog-head"><h2 id="batchTitle"></h2><button type="button" id="closeBatch">关闭 ✕</button></div><div class="editor-body"><p id="batchDescription"></p><ul id="batchAccounts" class="batch-accounts"></ul><div class="editor-fields"><label>负责人<input id="batchOwner" list="ownerSuggestions" maxlength="80" placeholder="姓名；发送记录留空则保留原负责人"></label><label id="batchDateField">实际发送日期<input id="batchDate" type="date"></label><label id="batchChannelField">联系渠道<select id="batchChannel">${CHANNELS.filter(Boolean).map(c=>`<option>${c}</option>`).join('')}</select></label></div><p id="batchError" class="form-error" role="alert"></p><button id="batchSave" type="submit" class="primary">确认保存</button></div></form></dialog>`);
  function openBatch(mode){batchOrders=selectedRows().map(r=>r.order);if(!batchOrders.length)return;$('batchEditor').dataset.mode=mode;$('batchTitle').textContent=mode==='assign'?'批量分配负责人':'批量记录已发送';$('batchDescription').textContent=mode==='assign'?'仅为未建联账号标记“已分配，待发送”；已进入沟通的账号保留原状态。':'请核对名单，仅记录已经实际发送的账号。状态将统一更新为“已发送，待回复”。';$('batchAccounts').innerHTML=selectedRows().map(r=>`<li>${esc(codeOf(r))} · ${esc(r.name)} <small>${esc(store.get(r.order).status)}</small></li>`).join('');$('batchOwner').value='';$('batchOwner').required=mode==='assign';$('batchDate').value=shanghaiToday();$('batchDate').required=mode==='sent';$('batchDateField').hidden=mode!=='sent';$('batchChannelField').hidden=mode!=='sent';$('batchChannel').value=platform()==='wechat'?'公众号后台':'私信';$('batchError').textContent='';$('batchEditor').showModal();}
  $('trackerAssign').onclick=()=>openBatch('assign');$('trackerSent').onclick=()=>openBatch('sent');$('closeBatch').onclick=()=>$('batchEditor').close();
  $('batchForm').onsubmit=e=>{e.preventDefault();try{const mode=$('batchEditor').dataset.mode,owner=$('batchOwner').value.trim();if(mode==='assign'&&!owner)throw new Error('请填写负责人');store.saveMany(batchOrders,p=>mode==='assign'?{owner,status:p.status==='未建联'?'已分配，待发送':p.status}:{owner:owner||p.owner,status:'已发送，待回复',channel:$('batchChannel').value,firstContactAt:p.firstContactAt||$('batchDate').value,lastContactAt:$('batchDate').value},mode==='assign'?'批量分配负责人，等待实际建联':'批量确认已发送，等待回复');$('batchEditor').close();toast('已保存 '+batchOrders.length+' 个账号的本机进度。');}catch(error){$('batchError').textContent=error.message;}};
  for(const id of ['editFirst','editLast'])$(id+'Precision').onchange=()=>{const value=$(id).value,type=$(id+'Precision').value;$(id).type=type;$(id).value=type==='date'?value.slice(0,10):(value.length>10?value:'');};
  function setPlatform(next){if(next===currentPlatform)return;filters.set(currentPlatform,{stage,query:$('trackerQuery').value,group:$('trackerGroup').value,owner:$('trackerOwner').value,sort:$('trackerSort').value,selected:$('trackerOnlySelected').checked});currentPlatform=next;const f=filters.get(next)||{};stage=f.stage||'all';$('trackerQuery').value=f.query||'';$('trackerGroup').value='';$('trackerOwner').value='';$('trackerSort').value=f.sort||'order';$('trackerOnlySelected').checked=f.selected||false;render();$('trackerGroup').value=f.group||'';$('trackerOwner').value=f.owner||'';render();}
  render();
  return { render,openEditor,updateSelection,setPlatform,showDue(){reset();stage='due';render();} };
}
