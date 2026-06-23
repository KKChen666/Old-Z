import { useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
  Search,
  Grid3X3,
  List,
  FileText,
  Image,
  FileIcon,
  Link,
  Mail,
  MoreHorizontal,
  Trash2,
  Tag,
  X,
} from 'lucide-react';
import type { FileFilter, ViewMode } from '@/types';

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

export default function Files() {
  const { files, removeFile } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filter, setFilter] = useState<FileFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl font-bold text-parchment-100">文件中心</h1>
        <p className="text-sm text-parchment-400 mt-1">统一管理所有文件，支持全文搜索</p>
      </div>

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
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
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
                className="glass-card-hover p-4 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-lg ${fileColors[file.type]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="relative group">
                    <button className="p-1 rounded-md hover:bg-ink-700/50 text-parchment-400">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 top-8 w-32 py-1 bg-ink-800 rounded-lg shadow-xl border border-ink-700/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                      <button
                        onClick={() => removeFile(file.id)}
                        className="w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-ink-700/50 flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> 删除
                      </button>
                    </div>
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
                <th className="w-10"></th>
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
                        <span className="text-sm text-parchment-100">{file.name}</span>
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
                      <button
                        onClick={() => removeFile(file.id)}
                        className="p-1 rounded-md hover:bg-ink-700/50 text-parchment-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredFiles.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-ink-600 mx-auto mb-3" />
          <p className="text-parchment-400">没有找到匹配的文件</p>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
