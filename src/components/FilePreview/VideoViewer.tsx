import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { ensureHttps } from '@/lib/utils';

interface VideoViewerProps {
  url: string;
  name: string;
}

export default function VideoViewer({ url, name }: VideoViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex-1 flex items-center justify-center bg-black relative">
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
        </div>
      )}
      {error && (
        <div className="flex flex-col items-center gap-2 text-red-400">
          <AlertCircle className="w-8 h-8" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      <video
        src={ensureHttps(url)}
        controls
        autoPlay={false}
        className="max-w-full max-h-full"
        style={{ maxHeight: '80vh' }}
        onLoadStart={() => setLoading(true)}
        onLoadedData={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError('视频加载失败，可能格式不支持或文件损坏');
        }}
      >
        您的浏览器不支持视频播放
      </video>
    </div>
  );
}
