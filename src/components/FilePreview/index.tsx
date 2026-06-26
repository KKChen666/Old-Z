import { useState, useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import PDFViewer from './PDFViewer';
import DocxViewer from './DocxViewer';
import ExcelViewer from './ExcelViewer';
import ImageViewer from './ImageViewer';
import VideoViewer from './VideoViewer';
import AudioViewer from './AudioViewer';
import TextViewer from './TextViewer';
import CsvViewer from './CsvViewer';
import UnsupportedViewer from './UnsupportedViewer';

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

  // 文本
  if (['txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'java', 'py', 'rb', 'go', 'rs', 'c', 'cpp', 'h', 'hpp', 'sh', 'bash', 'yml', 'yaml', 'toml', 'ini', 'conf', 'log'].includes(ext)) return 'text';

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
      default:
        return <UnsupportedViewer name={name} url={url} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

      {/* 预览容器 */}
      <div className="relative w-[90vw] h-[90vh] max-w-6xl glass-card flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-4 border-b border-ink-700/50">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-sm font-medium text-parchment-200 truncate">
              {name}
            </h3>
            <span className="text-xs text-parchment-400 uppercase px-2 py-0.5 bg-ink-800 rounded">
              {ext}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download={name}
              className="p-2 rounded-lg hover:bg-ink-700/50 text-parchment-400 hover:text-parchment-200 transition-colors"
              title="下载"
            >
              <Download className="w-4 h-4" />
            </a>
            <a
              href={url}
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
          {renderViewer()}
        </div>
      </div>
    </div>
  );
}
