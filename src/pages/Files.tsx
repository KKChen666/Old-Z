import { useState, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { uploadToOSS } from '@/utils/oss';
import {
  Search,
  Grid3X3,
  List,
  FileText,
  Image,
  FileIcon,
  Link,
  Mail,
  Trash2,
  Tag,
  X,
  Upload,
  Loader2,
  Download,
  CheckSquare,
} from 'lucide-react';
import type { FileFilter, ViewMode, FileItem, Todo } from '@/types';

const fileIcons: Record<string, typeof FileText> = {
  document: FileText,
  image: Image,
  pdf: FileIcon,
  link: Link,
  email: Mail,
  other: FileIcon,
};

const fileColors: Record<string, string> = {
  document: 'text-blue-400 bg-blue-400/10',
  image: 'text-pink-400 bg-pink-400/10',
  pdf: 'text-red-400 bg-red-400/10',
  link: 'text-cyan-400 bg-cyan-400/10',
  email: 'text-yellow-400 bg-yellow-400/10',
  other: 'text-parchment-400 bg-parchment-400/10',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileType(name: string): 'document' | 'image' | 'pdf' | 'link' | 'email' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'txt', 'md', 'xlsx', 'xls', 'ppt', 'pptx'].includes(ext)) return 'document';
  return 'other';
}

function handleOpenFile(file: { name: string; url?: string }) {
  if (!file.url) return;
  // 先尝试在新窗口打开（浏览器会根据文件类型决定是直接显示还是下载）
  // 对于图片/PDF/视频等，浏览器会直接显示；对于 doc/xlsx 等会触发下载，用户可用本地应用打开
  window.open(file.url, '_blank');
}

export default function Files() {
  const { files, removeFile, addFile, addTimelineEvent, addTodo } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FileFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [selectedFileForTodo, setSelectedFileForTodo] = useState<FileItem | null>(null);
  const [todoTitle, setTodoTitle] = useState('');
  const [todoPriority, setTodoPriority] = useState<Todo['priority']>('medium');

  const allTags = [...new Set(files.flatMap((f) => f.tags))];

  const filteredFiles = files.filter((f) => {
    if (filter !== 'all' && f.type !== filter) return false;
    if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedTags.length > 0 && !selectedTags.some((t) => f.tags.includes(t))) return false;
    return true;
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(selectedFiles)) {
        const { url } = await uploadToOSS(file);
        const fileType = getFileType(file.name);

        addFile({
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          type: fileType,
          size: file.size,
          tags: ['手动上传'],
          url,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        addTimelineEvent({
          id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: 'file_upload',
          title: `上传了 ${file.name}`,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCreateTodoFromFile = (file: FileItem) => {
    setSelectedFileForTodo(file);
    setTodoTitle(`处理文件: ${file.name}`);
    setShowTodoForm(true);
  };

  const confirmCreateTodo = () => {
    if (!todoTitle.trim() || !selectedFileForTodo) return;
    const todo: Todo = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: todoTitle,
      description: '',
      priority: todoPriority,
      status: 'pending',
      tags: [],
      fileIds: [selectedFileForTodo.id],
      noteIds: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
    };
    addTodo(todo);
    addTimelineEvent({
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'todo_created',
      title: `创建了待办: ${todoTitle}`,
      timestamp: new Date().toISOString(),
    });
    setShowTodoForm(false);
    setSelectedFileForTodo(null);
    setTodoTitle('');
    setTodoPriority('medium');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-4 border-b border-ink-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-parchment-100">文件中心</h1>
            <p className="text-sm text-parchment-400 mt-1">统一管理所有文件，支持全文搜索</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-primary flex items-center gap-2"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? '上传中...' : '上传文件'}
          </button>
          <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Search & Controls */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文件..."
              className="input-field pl-10"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-ink-400 hover:text-parchment-300" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 bg-ink-900/80 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-ink-700 text-gold-400' : 'text-parchment-400 hover:text-parchment-200'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-ink-700 text-gold-400' : 'text-parchment-400 hover:text-parchment-200'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'document', 'image', 'pdf', 'link', 'email'] as FileFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-gold-400/20 text-gold-400 border border-gold-400/30'
                  : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
              }`}
            >
              {f === 'all' ? '全部' : f === 'document' ? '文档' : f === 'image' ? '图片' : f === 'pdf' ? 'PDF' : f === 'link' ? '链接' : '邮件'}
            </button>
          ))}
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3 h-3 text-parchment-400" />
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`tag cursor-pointer transition-all ${
                  selectedTags.includes(tag) ? 'ring-1 ring-gold-400/50 bg-gold-400/10 text-gold-300' : ''
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* File Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-3 gap-4">
            {filteredFiles.map((file, index) => {
              const Icon = fileIcons[file.type] || FileIcon;
              return (
                <div
                  key={file.id}
                  className="glass-card-hover p-4 animate-fade-in group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-lg ${fileColors[file.type]}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCreateTodoFromFile(file)}
                        className="p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-gold-400 transition-colors"
                        title="添加到待办"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                      {file.url && (
                        <button
                          onClick={() => handleOpenFile(file)}
                          className="p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-gold-400 transition-colors"
                          title="打开文件"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm(`确定删除文件"${file.name}"吗？`)) {
                            removeFile(file.id);
                          }
                        }}
                        className="p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p
                    className="text-sm font-medium text-parchment-100 truncate cursor-pointer hover:text-gold-400 transition-colors"
                    onClick={() => file.url && handleOpenFile(file)}
                    title="点击打开文件"
                  >
                    {file.name}
                  </p>
                  <p className="text-xs text-parchment-400 mt-1">
                    {formatFileSize(file.size)} &middot; {new Date(file.createdAt).toLocaleDateString('zh-CN')}
                  </p>
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {file.tags.map((tag) => (
                      <span key={tag} className="tag text-[10px]">{tag}</span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-700/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-parchment-400">名称</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-parchment-400">类型</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-parchment-400">大小</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-parchment-400">标签</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-parchment-400">日期</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => {
                  const Icon = fileIcons[file.type] || FileIcon;
                  return (
                    <tr key={file.id} className="border-b border-ink-800/30 hover:bg-ink-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => file.url && handleOpenFile(file)}
                        >
                          <Icon className="w-4 h-4 text-parchment-400" />
                          <span className="text-sm text-parchment-100 truncate max-w-[200px] hover:text-gold-400 transition-colors">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-parchment-400">{file.type}</td>
                      <td className="px-4 py-3 text-xs text-parchment-400">{formatFileSize(file.size)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {file.tags.map((tag) => (
                            <span key={tag} className="tag text-[10px]">{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-parchment-400">
                        {new Date(file.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCreateTodoFromFile(file)}
                            className="p-1 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-gold-400 transition-colors"
                            title="添加到待办"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                          </button>
                          {file.url && (
                            <button
                              onClick={() => handleOpenFile(file)}
                              className="p-1 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-gold-400 transition-colors"
                              title="打开文件"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm(`确定删除文件"${file.name}"吗？`)) {
                                removeFile(file.id);
                              }
                            }}
                            className="p-1 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-red-400 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredFiles.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-ink-600 mx-auto mb-3" />
            <p className="text-parchment-400">没有找到匹配的文件</p>
            <p className="text-xs text-ink-500 mt-1">拖拽文件到 Dashboard 或点击上方按钮上传</p>
          </div>
        )}
      </div>

      {/* Todo Creation Modal */}
      {showTodoForm && selectedFileForTodo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={() => setShowTodoForm(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
          <div className="relative w-full max-w-md glass-card p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-serif font-bold text-parchment-100">创建待办</h3>
              <button onClick={() => setShowTodoForm(false)} className="p-1 rounded-md hover:bg-ink-800 text-parchment-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 bg-ink-800/40 rounded-lg">
              <FileText className="w-5 h-5 text-parchment-400 flex-shrink-0" />
              <span className="text-sm text-parchment-200 truncate">{selectedFileForTodo.name}</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-parchment-400">待办标题</label>
              <input
                type="text"
                value={todoTitle}
                onChange={(e) => setTodoTitle(e.target.value)}
                className="input-field w-full"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-parchment-400">优先级</label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setTodoPriority(p)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      todoPriority === p
                        ? p === 'urgent' || p === 'high'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : p === 'medium'
                          ? 'bg-gold-400/20 text-gold-300 border border-gold-400/30'
                          : 'bg-forest-400/20 text-forest-200 border border-forest-400/30'
                        : 'bg-ink-800/60 text-parchment-400 border border-ink-700/30 hover:text-parchment-200'
                    }`}
                  >
                    {p === 'low' ? '低' : p === 'medium' ? '中' : p === 'high' ? '高' : '紧急'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={confirmCreateTodo} className="btn-primary flex-1">
                创建待办
              </button>
              <button onClick={() => setShowTodoForm(false)} className="btn-ghost flex-1">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
