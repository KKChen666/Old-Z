import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Upload, Download, Plus, Check, X, Loader2, Cloud, HardDrive, StickyNote, ListTodo, ChevronDown, ChevronUp, ArrowRight, CircleCheck, AlertTriangle } from 'lucide-react';
import { api } from '@/utils/api';

interface SavedRemote {
  name: string;
  key: string;
  label: string;
}

interface SyncItem {
  id: string;
  kind: 'note' | 'todo';
  title: string;
  content: string;
  updatedAt: string | null;
}

const itemKey = (item: Pick<SyncItem, 'kind' | 'id'>) => `${item.kind}:${item.id}`;

function formatSyncDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function toSelection(selected: Set<string>) {
  const notes: string[] = [];
  const todos: string[] = [];
  for (const value of selected) {
    const separator = value.indexOf(':');
    const kind = value.slice(0, separator);
    const id = value.slice(separator + 1);
    if (kind === 'note') notes.push(id);
    if (kind === 'todo') todos.push(id);
  }
  return { notes, todos };
}

function loadRemotes(): SavedRemote[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('oldz-remotes') || '[]');
    if (!Array.isArray(parsed)) return [];
    const remotes = parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map(item => ({
        name: typeof item.name === 'string' ? item.name : '',
        key: typeof item.key === 'string' ? item.key : '',
        label: typeof item.label === 'string' ? item.label : '',
      }))
      .filter(item => item.name && item.key)
      .map(item => ({ ...item, label: item.label || item.name }));
    // 迁移旧配置：服务器地址不再由客户端保存或提交。
    saveRemotes(remotes);
    return remotes;
  } catch {
    return [];
  }
}
function saveRemotes(remotes: SavedRemote[]) {
  localStorage.setItem('oldz-remotes', JSON.stringify(remotes));
}

type CompareStatus = 'changed' | 'local-only' | 'remote-only' | 'same';

interface ComparedItem {
  key: string;
  kind: 'note' | 'todo';
  title: string;
  status: CompareStatus;
  local?: SyncItem;
  remote?: SyncItem;
}

function normalizedValue(item?: SyncItem) {
  if (!item) return '';
  return `${item.title}\n${item.content}`.replace(/\r\n/g, '\n').trim();
}

function compareItems(localItems: SyncItem[], remoteItems: SyncItem[]): ComparedItem[] {
  const localMap = new Map(localItems.map(item => [itemKey(item), item]));
  const remoteMap = new Map(remoteItems.map(item => [itemKey(item), item]));
  const keys = new Set([...localMap.keys(), ...remoteMap.keys()]);
  return [...keys].map(key => {
    const local = localMap.get(key);
    const remote = remoteMap.get(key);
    const status: CompareStatus = !remote ? 'local-only' : !local ? 'remote-only' : normalizedValue(local) === normalizedValue(remote) ? 'same' : 'changed';
    return {
      key,
      kind: (local || remote)!.kind,
      title: local?.title || remote?.title || '未命名',
      status,
      local,
      remote,
    };
  }).sort((a, b) => {
    const order: Record<CompareStatus, number> = { changed: 0, 'local-only': 1, 'remote-only': 2, same: 3 };
    return order[a.status] - order[b.status] || a.title.localeCompare(b.title, 'zh-CN');
  });
}

function readableLines(item?: SyncItem): string[] {
  if (!item) return [];
  const text = `标题：${item.title}\n${item.content}`
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
  return text.split('\n').map(line => line.trimEnd()).filter((line, index, lines) => line || (index > 0 && lines[index - 1]));
}

function buildLineDiff(local?: SyncItem, remote?: SyncItem): Array<{ type: 'same' | 'remove' | 'add'; text: string }> {
  const left = readableLines(local).slice(0, 200);
  const right = readableLines(remote).slice(0, 200);
  if (left.length * right.length > 30000) {
    return [...left.map(text => ({ type: 'remove' as const, text })), ...right.map(text => ({ type: 'add' as const, text }))];
  }
  const table = Array.from({ length: left.length + 1 }, () => new Uint16Array(right.length + 1));
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i][j] = left[i] === right[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const result: Array<{ type: 'same' | 'remove' | 'add'; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) {
      result.push({ type: 'same', text: left[i] }); i++; j++;
    } else if (j < right.length && (i === left.length || table[i][j + 1] >= table[i + 1][j])) {
      result.push({ type: 'add', text: right[j++] });
    } else {
      result.push({ type: 'remove', text: left[i++] });
    }
  }
  return result;
}

function DiffView({ item }: { item: ComparedItem }) {
  const lines = buildLineDiff(item.local, item.remote);
  return (
    <div className="border-t border-ink-800/60 bg-ink-950/70 px-3 py-3">
      <div className="mb-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="flex items-center gap-1.5 text-amber-300"><HardDrive className="h-3 w-3" /> 本地版本</div>
        <div className="flex items-center gap-1.5 text-cyan-300"><Cloud className="h-3 w-3" /> 云端版本</div>
      </div>
      <div className="max-h-72 overflow-auto rounded-lg border border-ink-800/60 bg-[#0b0d0d] font-mono text-[11px] leading-5">
        {lines.length === 0 ? <p className="px-3 py-4 text-ink-600">没有可显示的正文内容</p> : lines.map((line, index) => (
          <div key={`${line.type}-${index}`} className={`grid grid-cols-[24px_1fr] px-2 ${line.type === 'remove' ? 'bg-red-500/10 text-red-300' : line.type === 'add' ? 'bg-emerald-500/10 text-emerald-300' : 'text-ink-500'}`}>
            <span className="select-none text-ink-700">{line.type === 'remove' ? '−' : line.type === 'add' ? '+' : ' '}</span>
            <span className="whitespace-pre-wrap break-words">{line.text || ' '}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-ink-600">红色仅存在于本地版本，绿色仅存在于云端版本。</p>
    </div>
  );
}

function suggestedDirection(item: ComparedItem): 'push' | 'pull' | null {
  if (item.status === 'local-only') return 'push';
  if (item.status === 'remote-only') return 'pull';
  if (item.status !== 'changed') return null;
  const localTime = new Date(item.local?.updatedAt || 0).getTime();
  const remoteTime = new Date(item.remote?.updatedAt || 0).getTime();
  if (localTime === remoteTime) return null;
  return localTime > remoteTime ? 'push' : 'pull';
}

export default function SyncStatusPage() {
  // 在线同步账户管理
  const [remotes, setRemotes] = useState<SavedRemote[]>(loadRemotes);
  const [activeRemote, setActiveRemote] = useState(() => localStorage.getItem('oldz-active-remote') || '');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState('');

  // 同步状态
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState('');
  const [msg, setMsg] = useState('');
  const [localItems, setLocalItems] = useState<SyncItem[]>([]);
  const [remoteItems, setRemoteItems] = useState<SyncItem[]>([]);
  const [selectedLocal, setSelectedLocal] = useState<Set<string>>(() => new Set());
  const [selectedRemote, setSelectedRemote] = useState<Set<string>>(() => new Set());
  const [remoteError, setRemoteError] = useState('');
  const [testing, setTesting] = useState(false);
  const [filter, setFilter] = useState<'all' | CompareStatus>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const current = remotes.find(r => r.name === activeRemote);
  const comparedItems = useMemo(() => compareItems(localItems, remoteItems), [localItems, remoteItems]);
  const visibleItems = filter === 'all' ? comparedItems : comparedItems.filter(item => item.status === filter);
  const summary = useMemo(() => ({
    changed: comparedItems.filter(item => item.status === 'changed').length,
    localOnly: comparedItems.filter(item => item.status === 'local-only').length,
    remoteOnly: comparedItems.filter(item => item.status === 'remote-only').length,
    same: comparedItems.filter(item => item.status === 'same').length,
  }), [comparedItems]);

  const toggleDirection = (key: string, direction: 'push' | 'pull') => {
    if (direction === 'push') {
      setSelectedLocal(previous => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
      setSelectedRemote(previous => { const next = new Set(previous); next.delete(key); return next; });
    } else {
      setSelectedRemote(previous => {
        const next = new Set(previous);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
      setSelectedLocal(previous => { const next = new Set(previous); next.delete(key); return next; });
    }
  };

  const selectSuggested = () => {
    const push = new Set<string>();
    const pull = new Set<string>();
    for (const item of comparedItems) {
      const direction = suggestedDirection(item);
      if (direction === 'push') push.add(item.key);
      if (direction === 'pull') pull.add(item.key);
    }
    setSelectedLocal(push);
    setSelectedRemote(pull);
  };

  // ============ Remote CRUD ============

  const persistRemotes = (updated: SavedRemote[], nextActive?: string) => {
    setRemotes(updated);
    saveRemotes(updated);
    if (nextActive !== undefined) {
      setActiveRemote(nextActive);
      localStorage.setItem('oldz-active-remote', nextActive);
    }
  };

  const addRemote = () => {
    if (!newName.trim() || !newKey.trim()) return;
    if (remotes.find(r => r.name === newName.trim())) { setMsg('配置名称已存在'); return; }
    const r: SavedRemote = { name: newName.trim(), key: newKey.trim(), label: newName.trim() };
    const updated = [...remotes, r];
    persistRemotes(updated, r.name);
    setNewName(''); setNewKey(''); setShowAdd(false);
    setMsg('');
  };

  const removeRemote = (name: string) => {
    const updated = remotes.filter(r => r.name !== name);
    const nextActive = activeRemote === name ? (updated[0]?.name || '') : activeRemote;
    persistRemotes(updated, nextActive);
  };

  const switchRemote = (name: string) => {
    persistRemotes(remotes, name === activeRemote ? '' : name);
    setMsg(''); setRemoteItems([]); setRemoteError('');
    setSelectedLocal(new Set()); setSelectedRemote(new Set());
    setFilter('all'); setExpandedKey(null);
  };

  // ============ Sync Status ============

  const loadStatus = useCallback(async () => {
    if (!current) { setLocalItems([]); setRemoteItems([]); return; }
    setLoading(true); setMsg(''); setRemoteError('');
    try {
      const data = await api.remoteSync.preview({ key: current.key });
      setLocalItems(data.local);
      setRemoteItems(data.remote);
      setSelectedLocal(new Set());
      setSelectedRemote(new Set());
      setExpandedKey(null);
      if (data.error) setRemoteError(data.error);
    } catch (e: any) {
      setRemoteError(e.message || '连接失败');
    } finally {
      setLoading(false);
    }
  }, [current]);

  useEffect(() => { if (current) loadStatus(); }, [current, loadStatus]);

  // ============ Push / Pull ============

  const handlePush = async () => {
    if (!current) return;
    if (selectedLocal.size === 0) { setMsg('请先选择要推送的笔记或待办'); return; }
    setSyncing('push');
    setMsg('');
    try {
      const r = await api.remoteSync.push({ name: current.name, key: current.key, selection: toSelection(selectedLocal) });
      const resultMessage = r.errors.length
        ? `推送部分失败：${r.notesPushed} 条笔记，${r.todosPushed} 条待办；${r.errors.join('；')}`
        : `推送成功：${r.notesPushed} 条笔记，${r.todosPushed} 条待办`;
      await loadStatus();
      setMsg(resultMessage);
    } catch (e: any) { setMsg('推送失败：' + (e.message || '')); }
    finally { setSyncing(''); }
  };

  const handlePull = async () => {
    if (!current) return;
    if (selectedRemote.size === 0) { setMsg('请先选择要拉取的笔记或待办'); return; }
    setSyncing('pull');
    setMsg('');
    try {
      const r = await api.remoteSync.pull({ name: current.name, key: current.key, selection: toSelection(selectedRemote) });
      const resultMessage = r.errors.length
        ? `拉取部分失败：${r.notesPulled} 条笔记，${r.todosPulled} 条待办；${r.errors.join('；')}`
        : `拉取成功：${r.notesPulled} 条笔记，${r.todosPulled} 条待办`;
      await loadStatus();
      setMsg(resultMessage);
    } catch (e: any) { setMsg('拉取失败：' + (e.message || '')); }
    finally { setSyncing(''); }
  };

  const handleTest = async () => {
    if (!current) return;
    setTesting(true);
    setMsg('');
    try {
      const r = await api.remoteSync.test({ key: current.key });
      if (r.ok) {
        setMsg(`连接成功 — ${r.serverInfo || '远端服务器可达'}`);
      } else {
        setMsg(`连接失败：${r.error || '未知错误'}`);
      }
    } catch (e: any) { setMsg('测试失败：' + (e.message || '')); }
    finally { setTesting(false); }
  };

  // ============ Render ============

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-parchment-100">同步</h1>
          <p className="text-xs text-ink-500 mt-0.5">{current ? `当前配置: ${current.name}` : '尚未配置在线同步'}</p>
        </div>
        {current && (
          <button onClick={() => loadStatus()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-ink-700/50 text-ink-400 hover:text-parchment-200 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
          </button>
        )}
      </div>

      {/* 在线同步账户 */}
      <div className="mb-4 rounded-xl border border-ink-800/50 bg-ink-900/35 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-gold-400" />
            <h3 className="text-sm font-medium text-parchment-100">在线账户</h3>
            {remotes.length > 0 && <span className="text-[10px] text-ink-600">点击配置可切换</span>}
          </div>
          <button onClick={() => { setShowAdd(!showAdd); setMsg(''); }}
            className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-parchment-300 px-2 py-1 rounded-lg hover:bg-ink-800/50">
            <Plus className="w-3 h-3" /> 添加密钥
          </button>
        </div>
        <p className="text-[11px] text-ink-600 mb-2">同步密钥用于识别在线账户；服务器地址由应用统一管理。</p>

        {/* 添加同步配置表单 */}
        {showAdd && (
          <div className="p-3 rounded-xl border border-ink-800/50 bg-ink-900/60 mb-2 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="配置名称（如：我的在线账户）"
                className="min-w-44 flex-1 px-3 py-1.5 bg-ink-950/80 border border-ink-700/50 rounded-lg text-parchment-100 text-xs placeholder-ink-600 outline-none focus:border-gold-400/60" />
              <input type="password" value={newKey} onChange={e => setNewKey(e.target.value)}
                placeholder="同步密钥 (sk-oldz-...)"
                className="min-w-0 flex-[2] px-3 py-1.5 bg-ink-950/80 border border-ink-700/50 rounded-lg text-parchment-100 text-xs font-mono placeholder-ink-600 outline-none focus:border-gold-400/60" />
              <button onClick={addRemote} disabled={!newName.trim() || !newKey.trim()}
                className="px-3 py-1.5 bg-gold-400/20 border border-gold-400/30 text-gold-300 hover:bg-gold-400/30 rounded-lg text-xs disabled:opacity-30">
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 同步配置列表 — 只能选一个 */}
        {remotes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {remotes.map(r => (
              <button key={r.name}
                onClick={() => switchRemote(r.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  activeRemote === r.name
                    ? 'bg-gold-400/10 border border-gold-400/30 text-gold-300'
                    : 'bg-ink-900/60 border border-ink-800/50 text-parchment-400 hover:border-ink-700/50'
                }`}>
                <Cloud className="w-3 h-3" />
                <span className="font-mono">{r.name}</span>
                {r.label !== r.name && <span className="text-ink-600">({r.label})</span>}
                <span onClick={(e) => { e.stopPropagation(); removeRemote(r.name); }}
                  className="ml-1 p-0.5 text-ink-600 hover:text-red-400 rounded">
                  <X className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-600">
            尚未配置同步密钥。添加在线账户后即可同步笔记和待办。
          </p>
        )}
      </div>

      {/* 消息 */}
      {msg && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-xs ${
          msg.includes('失败') ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-forest-800/20 border border-forest-600/30 text-parchment-200'
        }`}>{msg}</div>
      )}

      {/* 无同步配置 */}
      {!current && (
        <div className="text-center py-12">
          <Cloud className="w-10 h-10 text-ink-600 mx-auto mb-3" />
          <p className="text-sm text-ink-500">尚未配置在线同步</p>
          <p className="text-xs text-ink-600 mt-1">添加在线账户的同步密钥即可开始同步</p>
        </div>
      )}

      {/* 同步状态 & 操作 */}
      {current && (
        <div className="space-y-4">
          {/* 同步工作台 */}
          <div className="glass-card p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-parchment-100">同步工作台</h3>
                <p className="mt-1 text-[11px] text-ink-500">先看差异，再选择用本地覆盖云端，或用云端覆盖本地。</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleTest} disabled={testing}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-700/50 px-2.5 py-1.5 text-[11px] text-ink-400 hover:text-parchment-200 disabled:opacity-50">
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CircleCheck className="h-3 w-3" />} 验证密钥
                </button>
                <button type="button" onClick={() => loadStatus()} disabled={loading}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-700/50 px-2.5 py-1.5 text-[11px] text-ink-400 hover:text-parchment-200 disabled:opacity-50">
                  <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> 重新比较
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-3 overflow-hidden rounded-xl border border-ink-800/60 bg-ink-950/40 text-[10px] text-ink-500">
              <div className="flex items-center justify-center gap-1.5 px-2 py-2.5 text-parchment-300"><span className="grid h-5 w-5 place-items-center rounded-full bg-gold-400/15 text-gold-300">1</span> 查看差异</div>
              <div className="flex items-center justify-center gap-1.5 border-x border-ink-800/60 px-2 py-2.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-ink-800 text-ink-400">2</span> 选择方向</div>
              <div className="flex items-center justify-center gap-1.5 px-2 py-2.5"><span className="grid h-5 w-5 place-items-center rounded-full bg-ink-800 text-ink-400">3</span> 执行同步</div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-xs text-ink-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在比较本地与云端...</div>
            ) : remoteError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <div><p className="text-sm text-red-300">暂时无法读取云端内容</p><p className="mt-1 text-xs text-red-400/80">{remoteError}</p><p className="mt-2 text-[10px] text-ink-500">请先验证同步密钥；连接恢复后再比较和选择同步方向。</p></div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {[
                    { key: 'changed' as const, label: '内容不同', value: summary.changed, tone: 'text-amber-300' },
                    { key: 'local-only' as const, label: '仅在本地', value: summary.localOnly, tone: 'text-orange-300' },
                    { key: 'remote-only' as const, label: '仅在云端', value: summary.remoteOnly, tone: 'text-cyan-300' },
                    { key: 'same' as const, label: '已经一致', value: summary.same, tone: 'text-emerald-300' },
                  ].map(card => (
                    <button key={card.key} type="button" onClick={() => setFilter(filter === card.key ? 'all' : card.key)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors ${filter === card.key ? 'border-gold-400/40 bg-gold-400/10' : 'border-ink-800/60 bg-ink-950/45 hover:border-ink-700'}`}>
                      <span className={`block text-xl font-semibold ${card.tone}`}>{card.value}</span>
                      <span className="mt-0.5 block text-[10px] text-ink-500">{card.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {([['all', '全部'], ['changed', '有差异'], ['local-only', '仅本地'], ['remote-only', '仅云端'], ['same', '已一致']] as const).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setFilter(value)}
                        className={`rounded-lg px-2.5 py-1.5 ${filter === value ? 'bg-parchment-100 text-ink-950' : 'bg-ink-900 text-ink-500 hover:text-parchment-300'}`}>{label}</button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 text-[10px]">
                    <button type="button" onClick={selectSuggested} className="rounded-lg border border-gold-400/20 px-2.5 py-1.5 text-gold-300 hover:bg-gold-400/10">按更新时间选择建议</button>
                    <button type="button" onClick={() => { setSelectedLocal(new Set()); setSelectedRemote(new Set()); }} className="rounded-lg px-2.5 py-1.5 text-ink-500 hover:bg-ink-900">清空选择</button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-ink-800/60">
                  <div className="hidden grid-cols-[minmax(180px,1fr)_110px_140px_280px] gap-3 border-b border-ink-800/60 bg-ink-950/70 px-3 py-2 text-[10px] text-ink-600 md:grid">
                    <span>内容</span><span>状态</span><span>更新时间</span><span className="text-right">选择同步方向</span>
                  </div>
                  {visibleItems.length === 0 ? (
                    <p className="px-4 py-12 text-center text-xs text-ink-600">当前筛选下没有内容</p>
                  ) : visibleItems.map(item => {
                    const suggestion = suggestedDirection(item);
                    const pushSelected = selectedLocal.has(item.key);
                    const pullSelected = selectedRemote.has(item.key);
                    const statusLabel = item.status === 'changed' ? '内容不同' : item.status === 'local-only' ? '仅在本地' : item.status === 'remote-only' ? '仅在云端' : '已一致';
                    const statusTone = item.status === 'changed' ? 'bg-amber-500/10 text-amber-300' : item.status === 'local-only' ? 'bg-orange-500/10 text-orange-300' : item.status === 'remote-only' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-emerald-500/10 text-emerald-300';
                    return (
                      <div key={item.key} className="border-b border-ink-800/50 last:border-b-0">
                        <div className="grid gap-3 px-3 py-3 md:grid-cols-[minmax(180px,1fr)_110px_140px_280px] md:items-center">
                          <div className="flex min-w-0 items-center gap-2">
                            {item.kind === 'note' ? <StickyNote className="h-4 w-4 shrink-0 text-parchment-400" /> : <ListTodo className="h-4 w-4 shrink-0 text-cyan-400" />}
                            <div className="min-w-0"><p className="truncate text-xs text-parchment-100">{item.title}</p><p className="text-[9px] text-ink-600">{item.kind === 'note' ? '笔记' : '待办'}</p></div>
                          </div>
                          <div><span className={`inline-flex rounded-md px-2 py-1 text-[10px] ${statusTone}`}>{statusLabel}</span></div>
                          <div className="text-[9px] leading-4 text-ink-600">
                            <p>本地 {formatSyncDate(item.local?.updatedAt || null) || '—'}</p><p>云端 {formatSyncDate(item.remote?.updatedAt || null) || '—'}</p>
                          </div>
                          <div className="flex flex-wrap items-center justify-start gap-1.5 md:justify-end">
                            {item.local && item.status !== 'same' && <button type="button" onClick={() => toggleDirection(item.key, 'push')}
                              className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] ${pushSelected ? 'border-amber-400/50 bg-amber-400/20 text-amber-200' : 'border-ink-700/60 text-ink-400 hover:border-amber-400/30 hover:text-amber-300'}`}>
                              <HardDrive className="h-3 w-3" /><ArrowRight className="h-3 w-3" /><Cloud className="h-3 w-3" /> 本地 → 云端{suggestion === 'push' ? ' · 建议' : ''}
                            </button>}
                            {item.remote && item.status !== 'same' && <button type="button" onClick={() => toggleDirection(item.key, 'pull')}
                              className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] ${pullSelected ? 'border-cyan-400/50 bg-cyan-400/20 text-cyan-200' : 'border-ink-700/60 text-ink-400 hover:border-cyan-400/30 hover:text-cyan-300'}`}>
                              <Cloud className="h-3 w-3" /><ArrowRight className="h-3 w-3" /><HardDrive className="h-3 w-3" /> 云端 → 本地{suggestion === 'pull' ? ' · 建议' : ''}
                            </button>}
                            {item.status === 'same' && <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CircleCheck className="h-3 w-3" /> 无需同步</span>}
                            <button type="button" onClick={() => setExpandedKey(expandedKey === item.key ? null : item.key)} className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] text-ink-500 hover:bg-ink-800/60 hover:text-parchment-300">
                              {expandedKey === item.key ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}{item.status === 'changed' ? '查看 diff' : '查看内容'}
                            </button>
                          </div>
                        </div>
                        {expandedKey === item.key && <DiffView item={item} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 固定执行区 */}
          <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border border-ink-700/70 bg-ink-950/95 p-3 shadow-2xl backdrop-blur md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-parchment-200">同步计划</p>
              <p className="mt-0.5 text-[10px] text-ink-500">{selectedLocal.size + selectedRemote.size === 0 ? '尚未选择任何操作' : `将推送 ${selectedLocal.size} 项，拉取 ${selectedRemote.size} 项；同一项只会执行一个方向。`}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex">
              <button onClick={handlePull} disabled={!!syncing || selectedRemote.size === 0}
                className="flex min-w-36 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-4 py-2.5 text-xs font-medium text-cyan-300 hover:bg-cyan-500/25 disabled:opacity-35">
                {syncing === 'pull' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} 拉取 {selectedRemote.size} 项
              </button>
              <button onClick={handlePush} disabled={!!syncing || selectedLocal.size === 0}
                className="flex min-w-36 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/15 px-4 py-2.5 text-xs font-medium text-amber-300 hover:bg-amber-500/25 disabled:opacity-35">
                {syncing === 'push' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} 推送 {selectedLocal.size} 项
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
