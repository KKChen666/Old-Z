import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Upload, Download, Plus, Trash2, GitBranch, Check, X, Loader2, Cloud, HardDrive, StickyNote, ListTodo } from 'lucide-react';
import { api } from '@/utils/api';

interface SavedRemote {
  name: string;
  url: string;
  key: string;
  label: string;
}

interface SyncCounts {
  notes: number;
  todos: number;
}

function loadRemotes(): SavedRemote[] {
  try { return JSON.parse(localStorage.getItem('oldz-remotes') || '[]'); } catch { return []; }
}
function saveRemotes(remotes: SavedRemote[]) {
  localStorage.setItem('oldz-remotes', JSON.stringify(remotes));
}

export default function SyncStatusPage() {
  // 远端管理
  const [remotes, setRemotes] = useState<SavedRemote[]>(loadRemotes);
  const [activeRemote, setActiveRemote] = useState(() => localStorage.getItem('oldz-active-remote') || '');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  // 同步状态
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState('');
  const [msg, setMsg] = useState('');
  const [localCounts, setLocalCounts] = useState<SyncCounts | null>(null);
  const [remoteCounts, setRemoteCounts] = useState<SyncCounts | null>(null);
  const [remoteError, setRemoteError] = useState('');
  const [testing, setTesting] = useState(false);

  const current = remotes.find(r => r.name === activeRemote);

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
    if (!newName.trim() || !newUrl.trim() || !newKey.trim()) return;
    if (remotes.find(r => r.name === newName.trim())) { setMsg('远端名称已存在'); return; }
    const r: SavedRemote = { name: newName.trim(), url: newUrl.trim().replace(/\/+$/, ''), key: newKey.trim(), label: newLabel.trim() || newName.trim() };
    const updated = [...remotes, r];
    persistRemotes(updated, r.name);
    setNewName(''); setNewUrl(''); setNewKey(''); setNewLabel(''); setShowAdd(false);
    setMsg('');
  };

  const removeRemote = (name: string) => {
    const updated = remotes.filter(r => r.name !== name);
    const nextActive = activeRemote === name ? (updated[0]?.name || '') : activeRemote;
    persistRemotes(updated, nextActive);
  };

  const switchRemote = (name: string) => {
    persistRemotes(remotes, name === activeRemote ? '' : name);
    setMsg(''); setRemoteCounts(null); setRemoteError('');
  };

  // ============ Sync Status ============

  const loadStatus = useCallback(async () => {
    if (!current) { setLocalCounts(null); setRemoteCounts(null); return; }
    setLoading(true); setMsg(''); setRemoteError('');
    try {
      const data = await api.remoteSync.status({ url: current.url, key: current.key });
      setLocalCounts(data.local);
      setRemoteCounts(data.remote);
      if (data.error) setRemoteError(data.error);
    } catch (e: any) {
      setRemoteError(e.message || '连接失败');
    } finally {
      setLoading(false);
    }
  }, [current?.name, current?.url, current?.key]);

  useEffect(() => { if (current) loadStatus(); }, [loadStatus]);

  // ============ Push / Pull ============

  const handlePush = async () => {
    if (!current) return;
    setSyncing('push');
    setMsg('');
    try {
      const r = await api.remoteSync.push(current);
      setMsg(`推送成功：${r.notesPushed} 条笔记，${r.todosPushed} 条待办` + (r.errors.length ? `，${r.errors.length} 条失败` : ''));
      loadStatus();
    } catch (e: any) { setMsg('推送失败：' + (e.message || '')); }
    finally { setSyncing(''); }
  };

  const handlePull = async () => {
    if (!current) return;
    setSyncing('pull');
    setMsg('');
    try {
      const r = await api.remoteSync.pull(current);
      setMsg(`拉取成功：${r.notesPulled} 条笔记，${r.todosPulled} 条待办` + (r.errors.length ? `，${r.errors.length} 条失败` : ''));
      loadStatus();
    } catch (e: any) { setMsg('拉取失败：' + (e.message || '')); }
    finally { setSyncing(''); }
  };

  const handleTest = async () => {
    if (!current) return;
    setTesting(true);
    setMsg('');
    try {
      const r = await api.remoteSync.test({ url: current.url, key: current.key });
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
          <p className="text-xs text-ink-500 mt-0.5">{current ? `已连接: ${current.name}` : '未连接远端'}</p>
        </div>
        {current && (
          <button onClick={loadStatus} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-ink-700/50 text-ink-400 hover:text-parchment-200 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
          </button>
        )}
      </div>

      {/* 远端管理 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-gold-400" />
            <h3 className="text-sm font-medium text-parchment-100">远端服务器</h3>
            {remotes.length > 0 && <span className="text-[10px] text-ink-600">（一对一，点击切换）</span>}
          </div>
          <button onClick={() => { setShowAdd(!showAdd); setMsg(''); }}
            className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-parchment-300 px-2 py-1 rounded-lg hover:bg-ink-800/50">
            <Plus className="w-3 h-3" /> 添加
          </button>
        </div>

        {/* 添加远端表单 */}
        {showAdd && (
          <div className="p-3 rounded-xl border border-ink-800/50 bg-ink-900/60 mb-2 space-y-2">
            <div className="flex gap-2">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="名称 (如 home, office)"
                className="flex-1 px-3 py-1.5 bg-ink-950/80 border border-ink-700/50 rounded-lg text-parchment-100 text-xs placeholder-ink-600 outline-none focus:border-gold-400/60" />
              <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder="标签 (选填)"
                className="w-28 px-3 py-1.5 bg-ink-950/80 border border-ink-700/50 rounded-lg text-parchment-100 text-xs placeholder-ink-600 outline-none focus:border-gold-400/60" />
            </div>
            <input type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)}
              placeholder="服务器地址 (如 http://192.168.1.100:3001)"
              className="w-full px-3 py-1.5 bg-ink-950/80 border border-ink-700/50 rounded-lg text-parchment-100 text-xs font-mono placeholder-ink-600 outline-none focus:border-gold-400/60" />
            <div className="flex gap-2">
              <input type="password" value={newKey} onChange={e => setNewKey(e.target.value)}
                placeholder="同步密钥 (sk-oldz-...)"
                className="flex-1 px-3 py-1.5 bg-ink-950/80 border border-ink-700/50 rounded-lg text-parchment-100 text-xs font-mono placeholder-ink-600 outline-none focus:border-gold-400/60" />
              <button onClick={addRemote} disabled={!newName.trim() || !newUrl.trim() || !newKey.trim()}
                className="px-3 py-1.5 bg-gold-400/20 border border-gold-400/30 text-gold-300 hover:bg-gold-400/30 rounded-lg text-xs disabled:opacity-30">
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 远端列表 — 只能选一个 */}
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
            尚未配置远端。添加一个远端服务器来同步笔记和待办。
          </p>
        )}
      </div>

      {/* 消息 */}
      {msg && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-xs ${
          msg.includes('失败') ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-forest-800/20 border border-forest-600/30 text-parchment-200'
        }`}>{msg}</div>
      )}

      {/* 无远端 */}
      {!current && (
        <div className="text-center py-12">
          <Cloud className="w-10 h-10 text-ink-600 mx-auto mb-3" />
          <p className="text-sm text-ink-500">未连接远端</p>
          <p className="text-xs text-ink-600 mt-1">添加一个远端服务器开始同步笔记和待办</p>
        </div>
      )}

      {/* 同步状态 & 操作 */}
      {current && (
        <div className="space-y-4">
          {/* 状态卡片 */}
          <div className="glass-card p-4">
            <h3 className="text-sm font-medium text-parchment-100 mb-3">同步状态</h3>
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-ink-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> 加载中...</div>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-ink-950/60 border border-ink-800/50">
                  <div className="flex items-center gap-1.5 text-ink-500 mb-1">
                    <HardDrive className="w-3.5 h-3.5" /> 本地
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5"><StickyNote className="w-3 h-3 text-parchment-400" /><span className="text-parchment-200">{localCounts?.notes ?? '-'} 条笔记</span></div>
                    <div className="flex items-center gap-1.5"><ListTodo className="w-3 h-3 text-parchment-400" /><span className="text-parchment-200">{localCounts?.todos ?? '-'} 条待办</span></div>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${remoteError ? 'bg-red-500/5 border-red-500/20' : 'bg-ink-950/60 border-ink-800/50'}`}>
                  <div className="flex items-center gap-1.5 text-ink-500 mb-1">
                    <Cloud className="w-3.5 h-3.5" /> 远端
                  </div>
                  {remoteError ? (
                    <p className="text-red-400 text-[11px]">{remoteError}</p>
                  ) : (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5"><StickyNote className="w-3 h-3 text-parchment-400" /><span className="text-parchment-200">{remoteCounts?.notes ?? '-'} 条笔记</span></div>
                      <div className="flex items-center gap-1.5"><ListTodo className="w-3 h-3 text-parchment-400" /><span className="text-parchment-200">{remoteCounts?.todos ?? '-'} 条待办</span></div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleTest} disabled={testing}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-ink-900/80 border border-ink-700/50 text-parchment-300 hover:border-ink-600/50 hover:text-parchment-100 disabled:opacity-50 transition-colors">
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              测试连接
            </button>
            <button onClick={loadStatus} disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium bg-ink-900/80 border border-ink-700/50 text-parchment-300 hover:border-ink-600/50 hover:text-parchment-100 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              获取远端
            </button>
            <button onClick={handlePull} disabled={!!syncing}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50 transition-colors">
              {syncing === 'pull' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              拉取至本地
            </button>
            <button onClick={handlePush} disabled={!!syncing}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 transition-colors">
              {syncing === 'push' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              推送至远端
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
