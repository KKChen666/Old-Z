import { FileQuestion, Download } from 'lucide-react';

interface UnsupportedViewerProps {
  name: string;
  url?: string;
}

export default function UnsupportedViewer({ name, url }: UnsupportedViewerProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-ink-950 p-8">
      <FileQuestion className="w-16 h-16 text-ink-500" />
      <div className="text-center">
        <p className="text-parchment-300 text-sm">不支持预览此文件格式</p>
        <p className="text-parchment-400 text-xs mt-1">{name}</p>
      </div>
      {url && (
        <a
          href={url}
          download={name}
          className="btn-primary flex items-center gap-2 mt-4"
        >
          <Download className="w-4 h-4" />
          下载文件
        </a>
      )}
    </div>
  );
}
