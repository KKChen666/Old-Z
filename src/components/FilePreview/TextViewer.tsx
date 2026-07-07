import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchFileAsText } from './fileLoader';

interface TextViewerProps {
  url: string;
}

export default function TextViewer({ url }: TextViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadText = async () => {
      try {
        setLoading(true);
        setError(null);
        const text = await fetchFileAsText(url);
        setContent(text);
      } catch (err) {
        console.error('Failed to load text:', err);
        setError('文件加载失败');
      } finally {
        setLoading(false);
      }
    };
    loadText();
  }, [url]);

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
    <div className="flex-1 overflow-auto p-4 bg-ink-950">
      <pre className="text-sm text-parchment-200 font-mono whitespace-pre-wrap break-words">
        {content}
      </pre>
    </div>
  );
}
