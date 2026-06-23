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
} from 'lucide-react';
import type { TodoFilter, PriorityFilter, Todo } from '@/types';

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

  const filteredTodos = todos.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleAddTodo = () => {
    if (!newTitle.trim()) return;
    const todo: Todo = {
      id: `t-${Date.now()}`,
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

  const cycleStatus = (todo: Todo) => {
    const next: Record<string, Todo['status']> = {
      pending: 'in_progress',
      in_progress: 'completed',
      completed: 'pending',
    };
    updateTodo(todo.id, { status: next[todo.status] });
  };

  const toggleFile = (fileId: string) => {
    setNewFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  };

  const getFileNamesByIds = (ids: string[]) => {
    return ids.map((id) => files.find((f) => f.id === id)).filter(Boolean);
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
      <div className="p-6 pb-4 border-b border-ink-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-parchment-100">待办管理</h1>
            <p className="text-sm text-parchment-400 mt-1">
              {todos.filter((t) => t.status !== 'completed').length} 项待处理
            </p>
          </div>
          <button onClick={() => setShowNewTodo(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> 新建待办
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* New Todo Form */}
        {showNewTodo && (
          <div className="glass-card p-5 space-y-4 animate-slide-in-up">
            <div className="flex gap-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                placeholder="输入待办事项..."
                className="input-field flex-1"
                autoFocus
              />
              <button onClick={handleAddTodo} className="btn-primary">添加</button>
              <button onClick={resetNewTodo} className="btn-ghost">取消</button>
            </div>

            <div className="flex items-center gap-4">
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

              {/* Due Date */}
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-parchment-400" />
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="input-field !w-auto !py-1 !text-xs"
                />
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
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-parchment-400" />
            <span className="text-xs text-parchment-400">状态:</span>
          </div>
          {(['all', 'pending', 'in_progress', 'completed'] as TodoFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                statusFilter === f
                  ? 'bg-gold-400/20 text-gold-400 border border-gold-400/30'
                  : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
              }`}
            >
              {f === 'all' ? '全部' : statusLabels[f]}
            </button>
          ))}

          <div className="w-px h-5 bg-ink-700/50" />

          <span className="text-xs text-parchment-400">优先级:</span>
          {(['all', 'urgent', 'high', 'medium', 'low'] as PriorityFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setPriorityFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                priorityFilter === f
                  ? 'bg-gold-400/20 text-gold-400 border border-gold-400/30'
                  : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
              }`}
            >
              {f === 'all' ? '全部' : priorityLabels[f]}
            </button>
          ))}
        </div>

        {/* Todo List */}
        <div className="space-y-2">
          {filteredTodos.map((todo, index) => {
            const attachedFiles = getFileNamesByIds(todo.fileIds || []);
            return (
              <div
                key={todo.id}
                className={`glass-card border-l-4 ${priorityColors[todo.priority]} animate-fade-in`}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div className="flex items-start gap-3 p-4">
                  <button onClick={() => cycleStatus(todo)} className="mt-0.5 flex-shrink-0">
                    {todo.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-forest-400" />
                    ) : todo.status === 'in_progress' ? (
                      <div className="w-5 h-5 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
                    ) : (
                      <Circle className="w-5 h-5 text-ink-500 hover:text-gold-400 transition-colors" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
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
                        <span className="flex items-center gap-1 text-[10px] text-parchment-400">
                          <Clock className="w-3 h-3" />
                          {todo.dueDate}
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
                  </div>

                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
