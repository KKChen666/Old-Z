import { useState, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
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
} from 'lucide-react';

export default function Dashboard() {
  const { todos, files, notes, timeline, addFile, addTimelineEvent } = useAppStore();
  const [isDragging, setIsDragging] = useState(false);
  const [dropMessage, setDropMessage] = useState('');

  const pendingTodos = todos.filter((t) => t.status !== 'completed');
  const urgentTodos = todos.filter((t) => t.priority === 'urgent' || t.priority === 'high');
  const recentFiles = files.slice(0, 4);
  const recentNotes = notes.slice(0, 3);
  const recentEvents = timeline.slice(0, 5);

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
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      const droppedText = e.dataTransfer.getData('text/plain');

      if (droppedFiles.length > 0) {
        droppedFiles.forEach((file) => {
          const fileType = getFileType(file.name);
          const newFile = {
            id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: file.name,
            type: fileType,
            size: file.size,
            tags: ['拖拽上传'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          addFile(newFile);
          addTimelineEvent({
            id: `e-${Date.now()}`,
            type: 'file_upload',
            title: `上传了 ${file.name}`,
            relatedId: newFile.id,
            timestamp: new Date().toISOString(),
          });
        });
        setDropMessage(`已导入 ${droppedFiles.length} 个文件，AI 正在解析...`);
      } else if (droppedText) {
        const newFile = {
          id: `f-${Date.now()}`,
          name: `粘贴内容_${new Date().toLocaleTimeString('zh-CN')}.txt`,
          type: 'document' as const,
          size: droppedText.length,
          tags: ['粘贴', '文本'],
          content: droppedText,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addFile(newFile);
        setDropMessage('已导入文本内容，AI 正在分析...');
      }

      setTimeout(() => setDropMessage(''), 3000);
    },
    [addFile, addTimelineEvent]
  );

  return (
    <div
      className="p-6 max-w-7xl mx-auto space-y-6"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-parchment-100">
            Dashboard
          </h1>
          <p className="text-sm text-parchment-400 mt-1">
            欢迎回来，今天是 {new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-parchment-400">
          <Sparkles className="w-4 h-4 text-gold-400" />
          <span>AI 已就绪</span>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`drop-zone p-8 text-center transition-all duration-300 ${
          isDragging ? 'drop-zone-active' : 'hover:border-ink-500'
        }`}
      >
        <div className={`transition-transform duration-300 ${isDragging ? 'scale-110' : ''}`}>
          <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-gold-400' : 'text-ink-500'} transition-colors`} />
          <p className={`text-lg font-medium ${isDragging ? 'text-gold-400' : 'text-parchment-300'}`}>
            {isDragging ? '释放以导入内容' : '拖拽任何内容到这里'}
          </p>
          <p className="text-sm text-ink-400 mt-1">
            支持文件、图片、PDF、网页链接、邮件等
          </p>
        </div>
        {dropMessage && (
          <div className="mt-4 px-4 py-2 bg-forest-800/40 rounded-lg text-forest-200 text-sm animate-fade-in">
            <Sparkles className="w-4 h-4 inline mr-1" />
            {dropMessage}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '待处理任务', value: pendingTodos.length, icon: CheckCircle2, color: 'text-gold-400' },
          { label: '高优先级', value: urgentTodos.length, icon: AlertTriangle, color: 'text-red-400' },
          { label: '文件总数', value: files.length, icon: FileText, color: 'text-forest-300' },
          { label: '笔记总数', value: notes.length, icon: StickyNote, color: 'text-parchment-300' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-ink-800/60 ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-parchment-100">{stat.value}</p>
              <p className="text-xs text-parchment-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Today's Todos */}
        <div className="col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-lg font-semibold text-parchment-100">
              今日待办
            </h2>
            <span className="text-xs text-parchment-400">{pendingTodos.length} 项待处理</span>
          </div>
          <div className="space-y-3">
            {todos.slice(0, 5).map((todo) => (
              <div
                key={todo.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-ink-800/40 hover:bg-ink-800/60 transition-colors group"
              >
                <div className="mt-0.5">
                  {todo.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-forest-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-ink-500 group-hover:text-gold-400 transition-colors" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${todo.status === 'completed' ? 'line-through text-parchment-500' : 'text-parchment-100'}`}>
                    {todo.title}
                  </p>
                  {todo.description && (
                    <p className="text-xs text-parchment-400 mt-0.5 truncate">
                      {todo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`tag text-[10px] ${
                      todo.priority === 'high' ? 'priority-high' :
                      todo.priority === 'medium' ? 'priority-medium' : 'priority-low'
                    }`}>
                      {todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低'}
                    </span>
                    {todo.dueDate && (
                      <span className="flex items-center gap-1 text-[10px] text-parchment-400">
                        <Clock className="w-3 h-3" />
                        {todo.dueDate}
                      </span>
                    )}
                    {todo.subtasks.length > 0 && (
                      <span className="text-[10px] text-parchment-400">
                        {todo.subtasks.filter((s) => s.done).length}/{todo.subtasks.length} 子任务
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Reminders */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-gold-400" />
            <h2 className="font-serif text-lg font-semibold text-parchment-100">
              AI 提醒
            </h2>
          </div>
          <div className="space-y-3">
            {recentEvents.filter((e) => e.type === 'ai_reminder').length > 0 ? (
              recentEvents
                .filter((e) => e.type === 'ai_reminder')
                .map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg bg-gold-400/5 border border-gold-400/20 animate-pulse-glow"
                  >
                    <p className="text-sm text-parchment-100">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-parchment-400 mt-1">{event.description}</p>
                    )}
                  </div>
                ))
            ) : (
              <div className="p-3 rounded-lg bg-forest-800/20 border border-forest-600/20">
                <p className="text-sm text-forest-200">一切正常，继续保持！</p>
              </div>
            )}

            <div className="pt-3 border-t border-ink-700/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-forest-300" />
                <span className="text-xs font-medium text-parchment-300">本周进度</span>
              </div>
              <div className="w-full bg-ink-800 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-forest-500 to-gold-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${(todos.filter((t) => t.status === 'completed').length / todos.length) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-parchment-400 mt-1">
                已完成 {todos.filter((t) => t.status === 'completed').length}/{todos.length} 项任务
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent Files */}
        <div className="glass-card p-5">
          <h2 className="font-serif text-lg font-semibold text-parchment-100 mb-4">
            最近文件
          </h2>
          <div className="space-y-2">
            {recentFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-ink-800/40 transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-forest-800/40 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-forest-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-parchment-100 truncate">{file.name}</p>
                  <p className="text-[10px] text-parchment-400">
                    {formatFileSize(file.size)} &middot; {file.tags.join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Notes */}
        <div className="glass-card p-5">
          <h2 className="font-serif text-lg font-semibold text-parchment-100 mb-4">
            活跃笔记
          </h2>
          <div className="space-y-2">
            {recentNotes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-lg hover:bg-ink-800/40 transition-colors cursor-pointer"
              >
                <p className="text-sm font-medium text-parchment-100">{note.title}</p>
                <p className="text-xs text-parchment-400 mt-1 line-clamp-2">
                  {note.content.replace(/[#*\n]/g, ' ').slice(0, 100)}...
                </p>
                <div className="flex gap-1 mt-2">
                  {note.tags.map((tag) => (
                    <span key={tag} className="tag text-[10px]">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getFileType(name: string): 'document' | 'image' | 'pdf' | 'link' | 'email' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'md', 'xlsx', 'xls', 'ppt', 'pptx'].includes(ext)) return 'document';
  return 'other';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
