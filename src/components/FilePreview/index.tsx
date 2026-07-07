import { useState, useEffect, lazy, Suspense } from 'react';
import { X, Download, ExternalLink, Loader2 } from 'lucide-react';
import { ensureHttps } from '@/lib/utils';

// 懒加载各预览器 — 按需加载，减少首次预览的 JS 体积
const PDFViewer = lazy(() => import('./PDFViewer'));
const DocxViewer = lazy(() => import('./DocxViewer'));
const ExcelViewer = lazy(() => import('./ExcelViewer'));
const ImageViewer = lazy(() => import('./ImageViewer'));
const VideoViewer = lazy(() => import('./VideoViewer'));
const AudioViewer = lazy(() => import('./AudioViewer'));
const TextViewer = lazy(() => import('./TextViewer'));
const CsvViewer = lazy(() => import('./CsvViewer'));
const HtmlViewer = lazy(() => import('./HtmlViewer'));
const UnsupportedViewer = lazy(() => import('./UnsupportedViewer'));

interface FilePreviewProps {
  url: string;
  name: string;
  onClose: () => void;
}

// 获取文件扩展名
function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

// 判断文件类型
function getFileCategory(ext: string): string {
  // 文档
  if (['pdf'].includes(ext)) return 'pdf';
  if (['doc', 'docx'].includes(ext)) return 'docx';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  if (['csv'].includes(ext)) return 'csv';
  if (['ppt', 'pptx'].includes(ext)) return 'unsupported'; // PPT 暂不支持

  // 图片
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)) return 'image';

  // 视频
  if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv'].includes(ext)) return 'video';

  // 音频
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext)) return 'audio';

  // HTML（在沙箱中渲染，而非展示源码）
  if (['html', 'htm'].includes(ext)) return 'html';

  // 文本
  if (['txt', 'md', 'json', 'xml', 'css', 'js', 'ts', 'jsx', 'tsx', 'java', 'py', 'rb', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'sh', 'bash', 'yml', 'yaml', 'toml', 'ini', 'conf', 'log'].includes(ext)) return 'text';

  return 'unsupported';
}

export default function FilePreview({ url, name, onClose }: FilePreviewProps) {
  const ext = getExtension(name);
  const category = getFileCategory(ext);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const renderViewer = () => {
    switch (category) {
      case 'pdf':
        return <PDFViewer url={url} />;
      case 'docx':
        return <DocxViewer url={url} />;
      case 'excel':
        return <ExcelViewer url={url} />;
      case 'csv':
        return <CsvViewer url={url} />;
      case 'image':
        return <ImageViewer url={url} name={name} />;
      case 'video':
        return <VideoViewer url={url} name={name} />;
      case 'audio':
        return <AudioViewer url={url} name={name} />;
      case 'text':
        return <TextViewer url={url} />;
      case 'html':
        return <HtmlViewer url={url} name={name} />;
      default:
        return <UnsupportedViewer name={name} url={url} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in p-2 sm:p-0 safe-area-pt safe-area-pb">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

      {/* 预览容器 */}
      <div className="relative h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem)] w-full max-w-6xl glass-card flex flex-col overflow-hidden sm:h-[90vh] sm:w-[90vw]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b border-ink-700/50">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h3 className="text-sm font-medium text-parchment-200 truncate">
              {name}
            </h3>
            <span className="text-xs text-parchment-400 uppercase px-2 py-0.5 bg-ink-800 rounded">
              {ext}
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <a
              href={ensureHttps(url)}
              download={name}
              className="p-2 rounded-lg hover:bg-ink-700/50 text-parchment-400 hover:text-parchment-200 transition-colors"
              title="下载"
            >
              <Download className="w-4 h-4" />
            </a>
            <a
              href={ensureHttps(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-ink-700/50 text-parchment-400 hover:text-parchment-200 transition-colors"
              title="新窗口打开"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-ink-700/50 text-parchment-400 hover:text-parchment-200 transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 预览内容 */}
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-gold-400" /></div>}>
            {renderViewer()}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
