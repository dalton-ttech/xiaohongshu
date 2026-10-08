export const STATUSES = ['未建联','已私信，待回复','已评论，待回复','已邮件，待回复','已回复，待跟进','沟通中','已确认合作','已发布','私信受限，待发送','邮件退信，待处理','已婉拒，暂不合作','暂停跟进'];
export const STORAGE_KEY = 'jev-xhs-progress-v1';
export const isMain = row => row.group === 'AI / 学术' || row.group === '法律 × AI';
export function shanghaiToday(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
}
export function stageOfStatus(status) {
  if (status === '未建联') return 'uncontacted';
  if (['已私信，待回复','已评论，待回复','已邮件，待回复'].includes(status)) return 'waiting';
  if (['已回复，待跟进','沟通中'].includes(status)) return 'replied';
  if (['私信受限，待发送','邮件退信，待处理'].includes(status)) return 'blocked';
  if (['已婉拒，暂不合作','暂停跟进'].includes(status)) return 'declined';
  return 'completed';
}
export const isDue = (record, today = shanghaiToday()) => Boolean(record.nextFollowUpAt && record.nextFollowUpAt <= today && !['已婉拒，暂不合作','暂停跟进','已发布'].includes(record.status));
function text(value, max, label) {
  if (typeof value !== 'string' || value.length > max) throw new Error(label + '格式不正确');
  return value;
}
function date(value, withTime, label) {
  text(value, 30, label);
  if (!value) return '';
  const pattern = withTime ? /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(value)) throw new Error(label + '格式不正确');
  const parsed = new Date(value + (withTime ? ':00Z' : 'T00:00:00Z'));
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, withTime ? 16 : 10) !== value) throw new Error(label + '不是有效日期');
  return value;
}
function timestamp(value) {
  text(value, 40, '记录更新时间');
  if (value && (!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) || !Number.isFinite(Date.parse(value)))) throw new Error('记录更新时间无效');
  return value;
}
function fields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('进度记录格式不正确');
  if (!STATUSES.includes(input.status)) throw new Error('未知的建联状态');
  const result = {
    status: input.status,
    owner: text(input.owner ?? '', 80, '负责人').trim(),
    firstContactAt: date(input.firstContactAt ?? '', true, '首次建联时间'),
    lastContactAt: date(input.lastContactAt ?? '', true, '最近跟进时间'),
    nextFollowUpAt: date(input.nextFollowUpAt ?? '', false, '下次跟进日期'),
    note: text(input.note ?? '', 2000, '备注').trim()
  };
  if (result.firstContactAt && result.lastContactAt && result.firstContactAt > result.lastContactAt) throw new Error('最近跟进时间不能早于首次建联时间');
  return result;
}
export function validateBackup(payload, data) {
  if (!payload || payload.schema !== 'jev-xhs-progress' || payload.version !== 1 || !Array.isArray(payload.records) || payload.records.length > data.length) throw new Error('请选择本看板导出的进度 JSON 文件');
  const seen = new Set();
  return payload.records.map(input => {
    const account = data.find(row => row.order === input.order);
    if (!account || input.redId !== account.redId || seen.has(input.order)) throw new Error('账号编号、小红书号不匹配或存在重复记录');
    seen.add(input.order);
    if (typeof input.tracked !== 'boolean') throw new Error('追踪标记格式不正确');
    const history = input.history ?? [];
    if (!Array.isArray(history) || history.length > 2000) throw new Error('跟进历史格式不正确');
    const historyIds = new Set();
    return {
      order: account.order, redId: account.redId, tracked: isMain(account) || input.tracked,
      ...fields(input), updatedAt: timestamp(input.updatedAt ?? ''),
      history: history.map(item => {
        const id = text(item.id, 100, '记录标识');
        if (!id || historyIds.has(id)) throw new Error('跟进历史包含重复或缺失的记录标识');
        historyIds.add(id);
        return { id, loggedAt: timestamp(item.loggedAt), message: text(item.message, 2000, '跟进记录'), ...fields(item) };
      })
    };
  });
}
export function createProgressStore(data, published, storage) {
  const publishedRecords = new Map(validateBackup(published, data).map(r => [r.order, r]));
  let drafts = new Map();
  let loadWarning = '';
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) drafts = new Map(validateBackup(JSON.parse(raw), data).map(r => [r.order, r]));
  } catch { loadWarning = '本机进度无法读取，请检查备份；已发布资料仍可查看。'; }
  const listeners = new Set();
  const base = order => {
    const row = data.find(r => r.order === order);
    if (!row) throw new Error('账号不存在');
    return { order, redId: row.redId, tracked:isMain(row), status:row.status, owner:'', firstContactAt:'', lastContactAt:'', nextFollowUpAt:'', note:'', updatedAt:'', history:[] };
  };
  const get = order => structuredClone(drafts.get(order) || publishedRecords.get(order) || base(order));
  const persist = next => {
    if (!storage) throw new Error('浏览器无法保存进度，请使用允许本地存储的浏览器');
    const payload = { schema:'jev-xhs-progress', version:1, exportedAt:new Date().toISOString(), records:[...next.values()] };
    try { storage.setItem(STORAGE_KEY, JSON.stringify(payload)); }
    catch { throw new Error('本机保存失败，可能存储空间不足；本次修改未保存，请先备份已有记录。'); }
    drafts = next;
    listeners.forEach(fn => fn());
  };
  const hasDraft = order => {
    const draft = drafts.get(order);
    return Boolean(draft && JSON.stringify(draft) !== JSON.stringify(publishedRecords.get(order) || base(order)));
  };
  return {
    get, loadWarning,
    initialStatus: order => base(order).status,
    isTracked: order => get(order).tracked,
    isDraft: hasDraft,
    draftCount: () => data.filter(r => hasDraft(r.order)).length,
    trackedRows: () => data.filter(r => get(r.order).tracked),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    save(order, patch, message = '') {
      const current = get(order);
      const values = fields({ ...current, ...patch });
      const tracked = isMain(data.find(r => r.order === order)) || (patch.tracked ?? current.tracked);
      if (typeof tracked !== 'boolean') throw new Error('追踪标记格式不正确');
      const updatedAt = new Date().toISOString();
      const historyEntry = { id:crypto.randomUUID(), loggedAt:updatedAt, message:text(message,2000,'跟进记录').trim() || '更新进度记录', ...values };
      if (current.history.length >= 2000) throw new Error('历史记录已达上限，请先导出备份');
      const record = { ...current, ...values, tracked, updatedAt, history:[...current.history,historyEntry] };
      const next = new Map(drafts); next.set(order,record); persist(next);
    },
    importRecords(records) {
      const safe = validateBackup({schema:'jev-xhs-progress',version:1,records},data);
      const next = new Map(drafts);
      for (const record of safe) {
        const current = get(record.order);
        // Preserve both histories even when the user chooses incoming current fields.
        const history = [...new Map([...current.history,...record.history].map(item=>[item.id,item])).values()].sort((a,b)=>a.loggedAt.localeCompare(b.loggedAt));
        if (history.length > 2000) throw new Error('合并后的历史记录过多，请检查备份');
        next.set(record.order,{...record,history});
      }
      persist(next);
    },
    backup() {
      return { schema:'jev-xhs-progress', version:1, exportedAt:new Date().toISOString(), records:data.filter(row=>get(row.order).tracked || drafts.has(row.order) || publishedRecords.has(row.order)).map(row=>get(row.order)) };
    }
  };
}
