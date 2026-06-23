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
  X,
} from 'lucide-react';
import type { TodoFilter, PriorityFilter, Todo } from '@/types';

export default function Todos() {
  const { todos, addTodo, updateTodo, toggleSubtask, deleteTodo } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<TodoFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [showNewTodo, setShowNewTodo] = useState(false);
  const [newTitle, setNewTitle] = useState('');
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
      priority: 'medium',
      status: 'pending',
      tags: [],
      fileIds: [],
      noteIds: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
    };
    addTodo(todo);
    setNewTitle('');
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
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

      {/* New Todo Form */}
      {showNewTodo && (
        <div className="glass-card p-4 animate-slide-in-up">
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
            <button onClick={handleAddTodo} className="btn-primary">
              添加
            </button>
            <button onClick={() => setShowNewTodo(false)} className="btn-ghost">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
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
        {filteredTodos.map((todo, index) => (
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
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-medium ${
                    todo.status === 'completed' ? 'line-through text-parchment-500' : 'text-parchment-100'
                  }`}>
                    {todo.title}
                  </p>
                </div>

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
                className="p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ opacity: 1 }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredTodos.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 text-ink-600 mx-auto mb-3" />
          <p className="text-parchment-400">没有匹配的待办事项</p>
        </div>
      )}
    </div>
  );
}
