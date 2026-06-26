import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import mammoth from 'mammoth';

interface DocxViewerProps {
  url: string;
}

// 通用的文件加载函数，支持各种 URL 类型
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  // 如果是 blob URL 或普通 URL，使用 XMLHttpRequest
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

  useEffect(() => {
    const loadDocx = async () => {
      try {
        setLoading(true);
        setError(null);

        // 获取文件内容
        const arrayBuffer = await fetchAsArrayBuffer(url);

        // 转换为 HTML
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
    <div className="flex-1 overflow-auto p-8 bg-white">
      <div
        className="prose prose-sm max-w-none text-gray-800
          [&_table]:border-collapse [&_table]:w-full
          [&_th]:border [&_th]:border-gray-300 [&_th]:p-2 [&_th]:bg-gray-100
          [&_td]:border [&_td]:border-gray-300 [&_td]:p-2
          [&_img]:max-w-full [&_img]:h-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
