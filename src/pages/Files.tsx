import { useState, useRef, useEffect } from 'react';
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
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
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

function FilePreviewModal({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [textContent, setTextContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [textError, setTextError] = useState(false);

  const isImage = file.type === 'image';
  const isPdf = file.name.split('.').pop()?.toLowerCase() === 'pdf';
  const isText = ['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'xml', 'csv', 'log', 'yaml', 'yml'].includes(
    file.name.split('.').pop()?.toLowerCase() || ''
  );
  const isDoc = ['doc', 'docx', 'xlsx', 'xls', 'ppt', 'pptx'].includes(
    file.name.split('.').pop()?.toLowerCase() || ''
  );
  const isVideo = ['mp4', 'webm', 'ogg', 'mov'].includes(file.name.split('.').pop()?.toLowerCase() || '');
  const isAudio = ['mp3', 'wav', 'ogg', 'aac', 'flac'].includes(file.name.split('.').pop()?.toLowerCase() || '');

  useEffect(() => {
    if (isText && file.url) {
      setLoading(true);
      setTextError(false);
      fetch(file.url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then((text) => setTextContent(text))
        .catch(() => setTextError(true))
        .finally(() => setLoading(false));
    }
  }, [file.url, isText]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleDownload = () => {
    if (!file.url) return;
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderFallback = (message: string) => (
    <div className="flex flex-col items-center justify-center h-full text-parchment-400">
      <FileIcon className="w-16 h-16 mb-4 text-ink-600" />
      <p className="text-lg font-medium">{message}</p>
      <div className="flex items-center gap-3 mt-4">
        <button onClick={handleDownload} className="btn-primary flex items-center gap-2">
          <Download className="w-4 h-4" /> 下载文件
        </button>
        {file.url && (
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="btn-ghost flex items-center gap-2">
            <Maximize2 className="w-4 h-4" /> 新窗口打开
          </a>
        )}
      </div>
    </div>
  );

  const renderPreview = () => {
    if (!file.url) return renderFallback('该文件没有可用的链接');

    if (isImage) {
      if (imageError) return renderFallback('图片加载失败');
      return (
        <div className="flex items-center justify-center h-full overflow-auto p-8">
          <img
            src={file.url}
            alt={file.name}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    if (isPdf) {
      return (
        <div className="w-full h-full relative">
          <iframe src={file.url} className="w-full h-full border-0" title={file.name} />
          <div className="absolute bottom-4 right-4">
            <button onClick={handleDownload} className="px-3 py-1.5 bg-ink-800/80 text-parchment-400 text-xs rounded-lg hover:bg-ink-700/80 transition-colors">
              加载异常？点击下载
            </button>
          </div>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="flex items-center justify-center h-full p-8">
          <video src={file.url} controls className="max-w-full max-h-full rounded-lg">您的浏览器不支持视频播放</video>
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <FileText className="w-20 h-20 text-gold-400" />
          <p className="text-parchment-200 font-medium">{file.name}</p>
          <audio src={file.url} controls className="w-80">您的浏览器不支持音频播放</audio>
        </div>
      );
    }

    if (isText) {
      if (loading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>;
      if (textError) return renderFallback('无法加载文件内容（可能是跨域限制）');
      return (
        <div className="h-full overflow-auto p-6">
          <pre className="text-parchment-200 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">{textContent}</pre>
        </div>
      );
    }

    if (isDoc) {
      const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`;
      return (
        <div className="w-full h-full relative">
          <iframe src={officeUrl} className="w-full h-full border-0" title={file.name} />
          <div className="absolute bottom-4 right-4">
            <button onClick={handleDownload} className="px-3 py-1.5 bg-ink-800/80 text-parchment-400 text-xs rounded-lg hover:bg-ink-700/80 transition-colors">
              无法预览？点击下载
            </button>
          </div>
        </div>
      );
    }

    return renderFallback('不支持预览此文件类型');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-[90vw] h-[85vh] max-w-5xl glass-card flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-700/50">
          <div className="flex items-center gap-3 min-w-0">
            {(() => { const Icon = fileIcons[file.type] || FileIcon; return <Icon className="w-5 h-5 text-parchment-400 flex-shrink-0" />; })()}
            <span className="text-parchment-100 font-medium truncate">{file.name}</span>
            <span className="text-xs text-parchment-400 flex-shrink-0">{formatFileSize(file.size)}</span>
          </div>
          <div className="flex items-center gap-1">
            {isImage && !imageError && (
              <>
                <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-parchment-100 transition-colors" title="缩小"><ZoomOut className="w-4 h-4" /></button>
                <span className="text-xs text-parchment-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-parchment-100 transition-colors" title="放大"><ZoomIn className="w-4 h-4" /></button>
                <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-parchment-100 transition-colors" title="旋转"><RotateCw className="w-4 h-4" /></button>
                <button onClick={() => { setZoom(1); setRotation(0); }} className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-parchment-100 transition-colors" title="重置"><Maximize2 className="w-4 h-4" /></button>
              </>
            )}
            {file.url && <a href={file.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-parchment-100 transition-colors" title="新窗口打开"><Maximize2 className="w-4 h-4" /></a>}
            <button onClick={handleDownload} className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-parchment-100 transition-colors" title="下载"><Download className="w-4 h-4" /></button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-ink-800 text-parchment-400 hover:text-parchment-100 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-ink-950/50">{renderPreview()}</div>
      </div>
    </div>
  );
}

export default function Files() {
  const { files, removeFile, addFile, addTimelineEvent, addTodo } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FileFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
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

  const handleDownload = (file: { name: string; url?: string }) => {
    if (file.url) {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
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
                          onClick={() => setPreviewFile(file)}
                          className="p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-gold-400 transition-colors"
                          title="预览"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {file.url && (
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-1.5 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-gold-400 transition-colors"
                          title="下载"
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
                  <p className="text-sm font-medium text-parchment-100 truncate">{file.name}</p>
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
                        <div className="flex items-center gap-3">
                          <Icon className="w-4 h-4 text-parchment-400" />
                          <span className="text-sm text-parchment-100 truncate max-w-[200px]">{file.name}</span>
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
                              onClick={() => setPreviewFile(file)}
                              className="p-1 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-gold-400 transition-colors"
                              title="预览"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {file.url && (
                            <button
                              onClick={() => handleDownload(file)}
                              className="p-1 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-gold-400 transition-colors"
                              title="下载"
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

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
