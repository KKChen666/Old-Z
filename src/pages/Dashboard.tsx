import { useState, useCallback, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/stores/useAppStore';
import { uploadToOSS } from '@/utils/oss';
import type { UploadProgress } from '@/utils/oss';
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Upload,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  StickyNote,
  FolderOpen,
  CalendarDays,
  AlertCircle,
} from 'lucide-react';
import type { Todo } from '@/types';
import { getFileType, getDateLabel, isOverdue, readFileText } from '@/lib/utils';
import { toast } from '@/components/Toast';

function todayStr(): string {
  return toDateKey(new Date());
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Dashboard() {
  const { todos, files, notes, addFile, addTimelineEvent, updateTodo, loadData } = useAppStore(useShallow((s) => ({
    todos: s.todos,
    files: s.files,
    notes: s.notes,
    addFile: s.addFile,
    addTimelineEvent: s.addTimelineEvent,
    updateTodo: s.updateTodo,
    loadData: s.loadData,
  })));
  const [isDragging, setIsDragging] = useState(false);
  const [dropMessage, setDropMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadCompleted, setUploadCompleted] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const today = todayStr();

  // Overdue todos
  const overdueTodos = todos.filter((t) => isOverdue(t));

  // Today's todos: dueDate=today OR isTodayTodo
  const todayTodos = todos.filter((t) => (t.dueDate === today || t.isTodayTodo) && t.status !== 'completed');

  // Upcoming: next 7 days, grouped by date
  const upcomingDays: { dateKey: string; label: string; todos: Todo[] }[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateKey = toDateKey(d);
    const dayTodos = todos.filter((t) => t.dueDate === dateKey && t.status !== 'completed');
    if (dayTodos.length > 0) {
      upcomingDays.push({
        dateKey,
        label: d.toLocaleDateString('zh-CN', { weekday: 'short', month: 'short', day: 'numeric' }),
        todos: dayTodos,
      });
    }
  }

  // Recent activity (files + notes + todos by createdAt, last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentFiles = files.filter((f) => new Date(f.createdAt) > weekAgo).slice(0, 5);
  const recentNotes = notes.filter((n) => new Date(n.updatedAt || n.createdAt) > weekAgo).slice(0, 5);

  // Stats
  const pendingTodos = todos.filter((t) => t.status !== 'completed');
  const urgentTodos = todos.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed');
  const completedToday = todos.filter((t) => t.status === 'completed' && t.dueDate === today);

  const cycleTodoStatus = (todo: Todo) => {
    const next: Record<string, Todo['status']> = { pending: 'completed', in_progress: 'completed', completed: 'pending' };
    updateTodo(todo.id, { status: next[todo.status] });
  };

  const priorityLabels: Record<string, string> = { urgent: '紧急', high: '高', medium: '中', low: '低' };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setUploading(true);
      const droppedFiles = Array.from(e.dataTransfer.files);
      const droppedText = e.dataTransfer.getData('text/plain');

      if (droppedFiles.length > 0) {
        setUploadProgress(0);
        setUploadTotal(droppedFiles.length);
        setUploadCompleted(0);
        setDropMessage(`正在上传 ${droppedFiles.length} 个文件...`);
        try {
          for (let i = 0; i < droppedFiles.length; i++) {
            const file = droppedFiles[i];
            const fileType = getFileType(file.name);
            const { url } = await uploadToOSS(file, 'uploads', {
              onProgress: (p: UploadProgress) => setUploadProgress(p.percent),
            });
            const content = await readFileText(file);
            const newFile = {
              id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: file.name, type: fileType, size: file.size,
              tags: ['拖拽上传'], url,
              content: content || undefined,
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            };
            addFile(newFile);
            addTimelineEvent({
              id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              type: 'file_upload', title: `上传了 ${file.name}`,
              relatedId: newFile.id, timestamp: new Date().toISOString(),
            });
            setUploadCompleted(i + 1);
            setUploadProgress(100);
          }
          setDropMessage(`已成功上传 ${droppedFiles.length} 个文件`);
        } catch (error: any) {
          console.error('Upload error:', error);
          setDropMessage('上传失败');
          toast.error(error?.message || '文件上传失败，请检查网络或 OSS 配置');
        }
      } else if (droppedText) {
        const newFile = {
          id: `f-${Date.now()}`, name: `粘贴内容_${new Date().toLocaleTimeString('zh-CN')}.txt`,
          type: 'document' as const, size: droppedText.length,
          tags: ['粘贴', '文本'], content: droppedText,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        addFile(newFile);
        setDropMessage('已导入文本内容');
      }
      setUploading(false);
      setTimeout(() => setDropMessage(''), 3000);
    },
    [addFile, addTimelineEvent]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;
      const filesArr = Array.from(selectedFiles);
      setUploading(true);
      setUploadProgress(0);
      setUploadTotal(filesArr.length);
      setUploadCompleted(0);
      setDropMessage(`正在上传 ${filesArr.length} 个文件...`);
      try {
        for (let i = 0; i < filesArr.length; i++) {
          const file = filesArr[i];
          const fileType = getFileType(file.name);
          const { url } = await uploadToOSS(file, 'uploads', {
            onProgress: (p: UploadProgress) => setUploadProgress(p.percent),
          });
          const content = await readFileText(file);
          const newFile = {
            id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: file.name, type: fileType, size: file.size,
            tags: ['本地上传'], url,
            content: content || undefined,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          };
          addFile(newFile);
          addTimelineEvent({
            id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: 'file_upload', title: `上传了 ${file.name}`,
            relatedId: newFile.id, timestamp: new Date().toISOString(),
          });
          setUploadCompleted(i + 1);
          setUploadProgress(100);
        }
        setDropMessage(`已成功上传 ${filesArr.length} 个文件`);
      } catch (error: any) {
        console.error('Upload error:', error);
        setDropMessage('上传失败');
        toast.error(error?.message || '文件上传失败，请检查网络或 OSS 配置');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => setDropMessage(''), 3000);
      }
    },
    [addFile, addTimelineEvent]
  );

  return (
    <div
      className="page-frame space-y-5 sm:space-y-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">总览</h1>
          <p className="page-description">
            欢迎回来，今天是 {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="page-status hidden sm:inline-flex">
          <Sparkles className="w-4 h-4 text-gold-400" />
          <span>AI 已就绪</span>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: '待处理任务', value: pendingTodos.length, icon: CheckCircle2, color: 'text-gold-400' },
          { label: '高优先级', value: urgentTodos.length, icon: AlertTriangle, color: 'text-red-400' },
          { label: '文件总数', value: files.length, icon: FileText, color: 'text-forest-300' },
          { label: '笔记总数', value: notes.length, icon: StickyNote, color: 'text-parchment-300' },
        ].map((stat) => (
          <div key={stat.label} className="surface-card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className={`p-1.5 sm:p-2 rounded-lg bg-ink-800/60 ${stat.color}`}>
              <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-parchment-100">{stat.value}</p>
              <p className="text-[10px] sm:text-xs text-parchment-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Drop Zone - compact */}
      <div
        className={`surface-card border-dashed p-4 sm:p-5 text-center transition-all duration-300 cursor-pointer ${
          isDragging ? 'drop-zone-active' : 'hover:border-ink-500'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
          <Upload className={`w-5 h-5 ${isDragging ? 'text-gold-400' : 'text-ink-500'} transition-colors`} />
          <p className={`text-xs sm:text-sm ${isDragging ? 'text-gold-400' : 'text-parchment-300'}`}>
            {uploading ? '正在上传...' : isDragging ? '释放以导入' : '拖拽文件到这里，或点击选择文件'}
          </p>
          <button
            className="btn-primary !text-xs !py-1 !px-3"
            disabled={uploading}
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          >
            <FolderOpen className="w-3.5 h-3.5 inline mr-1" />
            选择文件
          </button>
        </div>
        <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
        {dropMessage && (
          <div className="mt-2 px-4 py-1.5 bg-forest-800/40 rounded-lg text-forest-200 text-xs animate-fade-in">
            {dropMessage}
          </div>
        )}
        {uploading && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs text-parchment-400">
              <span>
                {uploadTotal > 1
                  ? `${uploadCompleted + 1}/${uploadTotal}`
                  : '上传中'}
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-gold-400 to-forest-400 transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content: Date-based Todo View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Overdue */}
          {overdueTodos.length > 0 && (
            <div className="surface-card p-4 sm:p-5 border-l-4 border-l-red-500">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <h2 className="section-heading !text-red-400">已过期</h2>
                <span className="text-xs text-red-400/70">{overdueTodos.length} 项</span>
              </div>
              <div className="space-y-2">
                {overdueTodos.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onToggle={cycleTodoStatus} priorityLabels={priorityLabels} overdue />
                ))}
              </div>
            </div>
          )}

          {/* Today */}
          <div className="surface-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gold-400" />
              <h2 className="section-heading">今天</h2>
              <span className="text-xs text-parchment-400">
                {todayTodos.length} 项待处理
                {completedToday.length > 0 && ` · ${completedToday.length} 项已完成`}
              </span>
            </div>
            {todayTodos.length === 0 && completedToday.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-8 h-8 text-ink-600 mx-auto mb-2" />
                <p className="text-sm text-parchment-400">今天暂无待办</p>
                <p className="text-xs text-ink-500 mt-1">在待办管理中设置截止日期或标星添加</p>
              </div>
            ) : (
              <div className="space-y-2">
                {todayTodos.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onToggle={cycleTodoStatus} priorityLabels={priorityLabels} />
                ))}
                {completedToday.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onToggle={cycleTodoStatus} priorityLabels={priorityLabels} />
                ))}
              </div>
            )}
          </div>

          {/* Upcoming: next 7 days grouped by date */}
          {upcomingDays.length > 0 && (
            <div className="surface-card p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="w-4 h-4 text-forest-300" />
                <h2 className="section-heading">未来日程</h2>
              </div>
              <div className="space-y-4">
                {upcomingDays.map((day) => (
                  <div key={day.dateKey}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-parchment-300">{day.label}</span>
                      <span className="text-[10px] text-ink-500">{day.todos.length} 项</span>
                      <div className="flex-1 h-px bg-ink-700/30" />
                    </div>
                    <div className="space-y-2">
                      {day.todos.map((todo) => (
                        <TodoItem key={todo.id} todo={todo} onToggle={cycleTodoStatus} priorityLabels={priorityLabels} compact />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {todayTodos.length === 0 && overdueTodos.length === 0 && upcomingDays.length === 0 && (
            <div className="surface-card p-6 sm:p-8 text-center">
              <CalendarDays className="w-10 h-10 sm:w-12 sm:h-12 text-ink-600 mx-auto mb-3" />
              <p className="text-parchment-400">暂无日程安排</p>
              <p className="text-xs text-ink-500 mt-1">创建待办并设置截止日期，即可在此查看</p>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Progress */}
          <div className="surface-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-forest-300" />
              <h2 className="section-heading">本周进度</h2>
            </div>
            <div className="w-full bg-ink-800 rounded-full h-2.5 mb-2">
              <div
                className="bg-gradient-to-r from-forest-500 to-gold-400 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${todos.length > 0 ? (todos.filter((t) => t.status === 'completed').length / todos.length) * 100 : 0}%` }}
              />
            </div>
            <p className="text-xs text-parchment-400">
              已完成 {todos.filter((t) => t.status === 'completed').length}/{todos.length} 项任务
            </p>
            {overdueTodos.length > 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-300">{overdueTodos.length} 项任务已过期</p>
              </div>
            )}
            {urgentTodos.length > 0 && (
              <div className="mt-2 p-2.5 rounded-lg bg-gold-400/10 border border-gold-400/20">
                <p className="text-xs text-gold-300">{urgentTodos.length} 项高优先级待处理</p>
              </div>
            )}
            {overdueTodos.length === 0 && urgentTodos.length === 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-forest-800/20 border border-forest-600/20">
                <p className="text-xs text-forest-200">进度良好，继续保持！</p>
              </div>
            )}
          </div>

          {/* Recent Activity: files + notes this week */}
          <div className="surface-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-gold-400" />
              <h2 className="section-heading">本周动态</h2>
            </div>
            <div className="space-y-2">
              {recentFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-ink-800/40 transition-colors cursor-pointer">
                  <FileText className="w-4 h-4 text-forest-300 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-parchment-200 truncate">{file.name}</p>
                    <p className="text-[10px] text-ink-500">{getDateLabel(file.createdAt.split('T')[0])}</p>
                  </div>
                </div>
              ))}
              {recentNotes.map((note) => (
                <div key={note.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-ink-800/40 transition-colors cursor-pointer">
                  <StickyNote className="w-4 h-4 text-parchment-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-parchment-200 truncate">{note.title}</p>
                    <p className="text-[10px] text-ink-500">{getDateLabel((note.updatedAt || note.createdAt).split('T')[0])}</p>
                  </div>
                </div>
              ))}
              {recentFiles.length === 0 && recentNotes.length === 0 && (
                <p className="text-xs text-ink-500 text-center py-4">本周暂无活动</p>
              )}
            </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function TodoItem({ todo, onToggle, priorityLabels, overdue, compact }: {
  todo: Todo;
  onToggle: (todo: Todo) => void;
  priorityLabels: Record<string, string>;
  overdue?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg hover:bg-ink-800/40 transition-colors group cursor-pointer ${
        overdue ? 'bg-red-500/5 border border-red-500/15' : 'bg-ink-800/20'
      } ${compact ? 'p-2' : 'p-3'}`}
      onClick={() => onToggle(todo)}
    >
      <div className={compact ? '' : 'mt-0.5'}>
        {todo.status === 'completed' ? (
          <CheckCircle2 className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-forest-400`} />
        ) : (
          <Circle className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-ink-500 group-hover:text-gold-400 transition-colors`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${todo.status === 'completed' ? 'line-through text-parchment-500' : 'text-parchment-100'} ${compact ? '!text-xs' : ''}`}>
          {todo.title}
        </p>
        {!compact && (
          <div className="flex items-center gap-2 mt-1">
            <span className={`tag text-[10px] ${
              todo.priority === 'urgent' ? 'priority-high' :
              todo.priority === 'high' ? 'priority-high' :
              todo.priority === 'medium' ? 'priority-medium' : 'priority-low'
            }`}>
              {priorityLabels[todo.priority]}
            </span>
            {todo.subtasks.length > 0 && (
              <span className="text-[10px] text-parchment-400">
                {todo.subtasks.filter((s) => s.done).length}/{todo.subtasks.length} 子任务
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

