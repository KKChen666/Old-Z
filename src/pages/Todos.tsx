import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
  Plus,
  Circle,
  CheckCircle2,
  Clock,
  Trash2,
  ChevronDown,
  ChevronRight,
  Filter,
  Paperclip,
  FileText,
  X,
  Star,
  Pencil,
  CalendarDays,
  AlertCircle,
} from 'lucide-react';
import type { TodoFilter, PriorityFilter, Todo } from '@/types';

function getDateLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff < -1) return `已过期 ${Math.abs(diff)} 天`;
  if (diff <= 7) return `${diff} 天后`;
  return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
}

function getDateGroup(dateStr: string | undefined): string {
  if (!dateStr) return 'no-date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(dateStr + 'T00:00:00');
  date.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'this-week';
  return 'later';
}

function formatQuickDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

const quickDateOptions = [
  { label: '今天', value: formatQuickDate(0) },
  { label: '明天', value: formatQuickDate(1) },
  { label: '后天', value: formatQuickDate(2) },
  { label: '下周一', value: (() => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d.toISOString().split('T')[0]; })() },
];

export default function Todos() {
  const { todos, files, addTodo, updateTodo, toggleSubtask, deleteTodo } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<TodoFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [showNewTodo, setShowNewTodo] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Todo['priority']>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [newFileIds, setNewFileIds] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<Todo['priority']>('medium');
  const [editDueDate, setEditDueDate] = useState('');

  const filteredTodos = todos.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  // Group by date
  const groupOrder = ['overdue', 'today', 'tomorrow', 'this-week', 'later', 'no-date'] as const;
  const groupLabels: Record<string, string> = {
    overdue: '已过期',
    today: '今天',
    tomorrow: '明天',
    'this-week': '本周',
    later: '更晚',
    'no-date': '无日期',
  };
  const groupIcons: Record<string, typeof Clock> = {
    overdue: AlertCircle,
    today: Clock,
    tomorrow: CalendarDays,
    'this-week': CalendarDays,
    later: CalendarDays,
    'no-date': Clock,
  };

  const grouped = new Map<string, Todo[]>();
  for (const todo of filteredTodos) {
    const group = getDateGroup(todo.dueDate);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group)!.push(todo);
  }

  const handleAddTodo = () => {
    if (!newTitle.trim()) return;
    const todo: Todo = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newTitle,
      description: '',
      priority: newPriority,
      status: 'pending',
      dueDate: newDueDate || undefined,
      tags: [],
      fileIds: newFileIds,
      noteIds: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
    };
    addTodo(todo);
    resetNewTodo();
  };

  const resetNewTodo = () => {
    setNewTitle('');
    setNewPriority('medium');
    setNewDueDate('');
    setNewFileIds([]);
    setShowFilePicker(false);
    setShowNewTodo(false);
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditPriority(todo.priority);
    setEditDueDate(todo.dueDate || '');
  };

  const saveEdit = () => {
    if (!editingId || !editTitle.trim()) return;
    updateTodo(editingId, {
      title: editTitle,
      priority: editPriority,
      dueDate: editDueDate || undefined,
    });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const cycleStatus = (todo: Todo) => {
    const next: Record<string, Todo['status']> = {
      pending: 'completed',
      in_progress: 'completed',
      completed: 'pending',
    };
    const newStatus = next[todo.status];
    updateTodo(todo.id, { status: newStatus });
  };

  const toggleTodayTodo = (todo: Todo) => {
    updateTodo(todo.id, { isTodayTodo: !todo.isTodayTodo });
  };

  const toggleFile = (fileId: string) => {
    setNewFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const getFileNamesByIds = (ids: string[]) => {
    return ids.map((id) => files.find((f) => f.id === id)).filter(Boolean);
  };

  const isOverdue = (todo: Todo) => {
    if (!todo.dueDate || todo.status === 'completed') return false;
    const today = new Date().toISOString().split('T')[0];
    return todo.dueDate < today;
  };

  const priorityColors: Record<string, string> = {
    urgent: 'border-l-red-500',
    high: 'border-l-orange-400',
    medium: 'border-l-gold-400',
    low: 'border-l-forest-400',
  };

  const priorityLabels: Record<string, string> = {
    urgent: '紧急',
    high: '高',
    medium: '中',
    low: '低',
  };

  const statusLabels: Record<string, string> = {
    pending: '待处理',
    in_progress: '进行中',
    completed: '已完成',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 sm:p-6 pb-3 sm:pb-4 border-b border-ink-800/50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-parchment-100">待办管理</h1>
            <p className="text-xs sm:text-sm text-parchment-400 mt-1">
              {todos.filter((t) => t.status !== 'completed').length} 项待处理
              {todos.filter(isOverdue).length > 0 && (
                <span className="text-red-400 ml-2">
                  · {todos.filter(isOverdue).length} 项已过期
                </span>
              )}
            </p>
          </div>
          <button onClick={() => setShowNewTodo(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> 新建待办
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* New Todo Form */}
        {showNewTodo && (
          <div className="glass-card p-4 sm:p-5 space-y-3 sm:space-y-4 animate-slide-in-up">
            <div className="flex gap-2 sm:gap-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                placeholder="输入待办事项..."
                className="input-field flex-1"
                autoFocus
              />
              <button onClick={handleAddTodo} className="btn-primary whitespace-nowrap">添加</button>
              <button onClick={resetNewTodo} className="btn-ghost hidden sm:block">取消</button>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              {/* Priority */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-parchment-400">优先级:</span>
                <div className="flex gap-1">
                  {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setNewPriority(p)}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                        newPriority === p
                          ? p === 'urgent' || p === 'high'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : p === 'medium'
                            ? 'bg-gold-400/20 text-gold-300 border border-gold-400/30'
                            : 'bg-forest-400/20 text-forest-200 border border-forest-400/30'
                          : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
                      }`}
                    >
                      {priorityLabels[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Date */}
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-parchment-400" />
                {quickDateOptions.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setNewDueDate(opt.value)}
                    className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                      newDueDate === opt.value
                        ? 'bg-gold-400/20 text-gold-300 border border-gold-400/30'
                        : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="input-field !w-auto !py-1 !text-xs"
                />
                {newDueDate && (
                  <button onClick={() => setNewDueDate('')} className="text-ink-500 hover:text-parchment-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Attach File */}
              <button
                onClick={() => setShowFilePicker(!showFilePicker)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  showFilePicker || newFileIds.length > 0
                    ? 'bg-gold-400/20 text-gold-400 border border-gold-400/30'
                    : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
                }`}
              >
                <Paperclip className="w-3 h-3" />
                关联文件 {newFileIds.length > 0 && `(${newFileIds.length})`}
              </button>
            </div>

            {/* File Picker */}
            {showFilePicker && (
              <div className="border border-ink-700/30 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                {files.length === 0 ? (
                  <p className="text-xs text-ink-500 text-center py-4">暂无文件，请先上传文件</p>
                ) : (
                  files.map((file) => (
                    <label
                      key={file.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        newFileIds.includes(file.id)
                          ? 'bg-gold-400/10 border border-gold-400/20'
                          : 'hover:bg-ink-800/40 border border-transparent'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={newFileIds.includes(file.id)}
                        onChange={() => toggleFile(file.id)}
                        className="w-3.5 h-3.5 rounded border-ink-600 bg-ink-800 text-gold-400 focus:ring-gold-400/20"
                      />
                      <FileText className="w-4 h-4 text-parchment-400 flex-shrink-0" />
                      <span className="text-xs text-parchment-200 truncate">{file.name}</span>
                      <span className="text-[10px] text-ink-500 ml-auto flex-shrink-0">{file.type}</span>
                    </label>
                  ))
                )}
              </div>
            )}

            {/* Attached Files Preview */}
            {newFileIds.length > 0 && !showFilePicker && (
              <div className="flex gap-2 flex-wrap">
                {getFileNamesByIds(newFileIds).map((file) => file && (
                  <div key={file.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-ink-800/40 text-[10px] text-parchment-400">
                    <FileText className="w-3 h-3" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button onClick={() => toggleFile(file.id)} className="hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-parchment-400" />
              <span className="text-xs text-parchment-400">状态:</span>
            </div>
            {(['all', 'pending', 'in_progress', 'completed'] as TodoFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${
                  statusFilter === f
                    ? 'bg-gold-400/20 text-gold-400 border border-gold-400/30'
                    : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
                }`}
              >
                {f === 'all' ? '全部' : statusLabels[f]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-parchment-400 ml-6">优先级:</span>
            {(['all', 'urgent', 'high', 'medium', 'low'] as PriorityFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setPriorityFilter(f)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${
                  priorityFilter === f
                    ? 'bg-gold-400/20 text-gold-400 border border-gold-400/30'
                    : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
                }`}
              >
                {f === 'all' ? '全部' : priorityLabels[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Todo List - grouped by date */}
        <div className="space-y-4">
          {groupOrder.map((groupKey) => {
            const items = grouped.get(groupKey);
            if (!items || items.length === 0) return null;
            const Icon = groupIcons[groupKey];
            return (
              <div key={groupKey}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${groupKey === 'overdue' ? 'text-red-400' : 'text-parchment-400'}`} />
                  <h3 className={`text-sm font-semibold ${groupKey === 'overdue' ? 'text-red-400' : 'text-parchment-200'}`}>
                    {groupLabels[groupKey]}
                  </h3>
                  <span className="text-xs text-ink-500">({items.length})</span>
                </div>
                <div className="space-y-2">
                  {items.map((todo, index) => {
                    const attachedFiles = getFileNamesByIds(todo.fileIds || []);
                    const editing = editingId === todo.id;
                    const overdue = isOverdue(todo);
                    return (
                      <div
                        key={todo.id}
                        className={`glass-card border-l-4 ${priorityColors[todo.priority]} animate-fade-in relative ${
                          overdue ? 'ring-1 ring-red-500/30' : ''
                        }`}
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        {todo.status === 'completed' && (
                          <div className="absolute left-4 right-4 top-1/2 h-[2px] bg-parchment-500/60 rounded-full z-10 pointer-events-none" />
                        )}
                        <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4">
                          <button onClick={() => cycleStatus(todo)} className="mt-0.5 flex-shrink-0">
                            {todo.status === 'completed' ? (
                              <CheckCircle2 className="w-5 h-5 text-forest-400" />
                            ) : (
                              <Circle className="w-5 h-5 text-ink-500 hover:text-gold-400 transition-colors" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            {editing ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                  className="input-field w-full"
                                  autoFocus
                                />
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
                                  <div className="flex gap-1">
                                    {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                                      <button
                                        key={p}
                                        onClick={() => setEditPriority(p)}
                                        className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                                          editPriority === p
                                            ? p === 'urgent' || p === 'high'
                                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                              : p === 'medium'
                                              ? 'bg-gold-400/20 text-gold-300 border border-gold-400/30'
                                              : 'bg-forest-400/20 text-forest-200 border border-forest-400/30'
                                            : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30'
                                        }`}
                                      >
                                        {priorityLabels[p]}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex gap-1">
                                    {quickDateOptions.map((opt) => (
                                      <button
                                        key={opt.label}
                                        onClick={() => setEditDueDate(opt.value)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                                          editDueDate === opt.value
                                            ? 'bg-gold-400/20 text-gold-300 border border-gold-400/30'
                                            : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                    <input
                                      type="date"
                                      value={editDueDate}
                                      onChange={(e) => setEditDueDate(e.target.value)}
                                      className="input-field !w-auto !py-0.5 !text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={saveEdit} className="btn-primary !py-1 !text-xs">保存</button>
                                  <button onClick={cancelEdit} className="btn-ghost !py-1 !text-xs">取消</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className={`text-sm font-medium ${
                                  todo.status === 'completed' ? 'line-through text-parchment-500' : 'text-parchment-100'
                                }`}>
                                  {todo.title}
                                </p>

                                {todo.description && (
                                  <p className="text-xs text-parchment-400 mt-1">{todo.description}</p>
                                )}

                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className={`tag text-[10px] ${
                                    todo.priority === 'urgent' || todo.priority === 'high' ? 'priority-high' :
                                    todo.priority === 'medium' ? 'priority-medium' : 'priority-low'
                                  }`}>
                                    {priorityLabels[todo.priority]}
                                  </span>
                                  {todo.dueDate && (
                                    <span className={`flex items-center gap-1 text-[10px] ${
                                      overdue ? 'text-red-400 font-medium' : 'text-parchment-400'
                                    }`}>
                                      <Clock className="w-3 h-3" />
                                      {getDateLabel(todo.dueDate)}
                                      {overdue && <span className="text-red-400">(过期)</span>}
                                    </span>
                                  )}
                                  {todo.tags.map((tag) => (
                                    <span key={tag} className="tag text-[10px]">{tag}</span>
                                  ))}
                                </div>

                                {/* Attached Files */}
                                {attachedFiles.length > 0 && (
                                  <div className="flex gap-1.5 mt-2 flex-wrap">
                                    {attachedFiles.map((file) => file && (
                                      <span
                                        key={file.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-800/50 text-[10px] text-parchment-400 border border-ink-700/30"
                                      >
                                        <FileText className="w-3 h-3" />
                                        {file.name}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Subtasks */}
                                {todo.subtasks.length > 0 && (
                                  <div className="mt-3">
                                    <button
                                      onClick={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                                      className="flex items-center gap-1 text-xs text-parchment-400 hover:text-parchment-200"
                                    >
                                      {expandedId === todo.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                      {todo.subtasks.filter((s) => s.done).length}/{todo.subtasks.length} 子任务
                                    </button>
                                    {expandedId === todo.id && (
                                      <div className="mt-2 space-y-1.5 pl-4">
                                        {todo.subtasks.map((sub) => (
                                          <label key={sub.id} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                              type="checkbox"
                                              checked={sub.done}
                                              onChange={() => toggleSubtask(todo.id, sub.id)}
                                              className="w-3.5 h-3.5 rounded border-ink-600 bg-ink-800 text-gold-400 focus:ring-gold-400/20"
                                            />
                                            <span className={`text-xs ${sub.done ? 'line-through text-parchment-500' : 'text-parchment-300'}`}>
                                              {sub.title}
                                            </span>
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {!editing && (
                            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                              <button
                                onClick={() => startEdit(todo)}
                                className="p-1 sm:p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-gold-400 transition-colors"
                                title="编辑"
                              >
                                <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                              <button
                                onClick={() => toggleTodayTodo(todo)}
                                className={`p-1 sm:p-1.5 rounded-md transition-colors ${
                                  todo.isTodayTodo
                                    ? 'text-gold-400 hover:text-gold-300'
                                    : 'text-parchment-400 hover:text-gold-400 hover:bg-ink-700/50'
                                }`}
                                title={todo.isTodayTodo ? '取消今日待办' : '设为今日待办'}
                              >
                                <Star className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${todo.isTodayTodo ? 'fill-gold-400' : ''}`} />
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`确定删除待办"${todo.title}"吗？`)) {
                                    deleteTodo(todo.id);
                                  }
                                }}
                                className="p-1 sm:p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {filteredTodos.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 text-ink-600 mx-auto mb-3" />
            <p className="text-parchment-400">没有匹配的待办事项</p>
          </div>
        )}
      </div>
    </div>
  );
}
