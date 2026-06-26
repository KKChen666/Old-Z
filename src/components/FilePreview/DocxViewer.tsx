import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ChevronUp, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';
import mammoth from 'mammoth';

interface DocxViewerProps {
  url: string;
}

// 通用的文件加载函数
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.response);
      } else {
        reject(new Error(`Failed to fetch: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send();
  });
}

export default function DocxViewer({ url }: DocxViewerProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [scrollPercent, setScrollPercent] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDocx = async () => {
      try {
        setLoading(true);
        setError(null);

        const arrayBuffer = await fetchAsArrayBuffer(url);
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtml(result.value);

        if (result.messages.length > 0) {
          console.warn('Docx conversion warnings:', result.messages);
        }
      } catch (err) {
        console.error('Failed to load docx:', err);
        setError('Word 文档加载失败');
      } finally {
        setLoading(false);
      }
    };
    loadDocx();
  }, [url]);

  // 监听滚动位置
  const handleScroll = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    const percent = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100) || 0;
    setScrollPercent(Math.min(100, Math.max(0, percent)));
  }, []);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!contentRef.current) return;
      const step = 100;
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        contentRef.current.scrollBy({ top: -step, behavior: 'smooth' });
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        contentRef.current.scrollBy({ top: step, behavior: 'smooth' });
      } else if (e.key === 'Home') {
        e.preventDefault();
        contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (e.key === 'End') {
        e.preventDefault();
        contentRef.current.scrollTo({ top: contentRef.current.scrollHeight, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.5));

  const scrollUp = () => contentRef.current?.scrollBy({ top: -300, behavior: 'smooth' });
  const scrollDown = () => contentRef.current?.scrollBy({ top: 300, behavior: 'smooth' });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-center gap-4 p-3 bg-ink-900/80 border-b border-ink-700/50">
        <div className="flex items-center gap-2">
          <button
            onClick={scrollUp}
            className="p-1.5 rounded hover:bg-ink-700"
            title="向上滚动"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-sm text-parchment-300 min-w-[50px] text-center">
            {scrollPercent}%
          </span>
          <button
            onClick={scrollDown}
            className="p-1.5 rounded hover:bg-ink-700"
            title="向下滚动"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        <div className="w-px h-5 bg-ink-700" />
        <div className="flex items-center gap-2">
          <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-ink-700">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-sm text-parchment-300 min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-ink-700">
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div
        ref={contentRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-8 bg-white"
        style={{ fontSize: `${scale * 100}%` }}
      >
        <div
          className="prose prose-sm max-w-none text-gray-800
            [&_table]:border-collapse [&_table]:w-full
            [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100
            [&_td]:border [&_td]:border-gray-300 [&_td]:p-2
            [&_img]:max-w-full [&_img]:h-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
