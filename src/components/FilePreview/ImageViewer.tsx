import { useState } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageViewerProps {
  url: string;
  name: string;
}

export default function ImageViewer({ url, name }: ImageViewerProps) {
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.25));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center justify-center gap-4 p-3 bg-ink-900/80 border-b border-ink-700/50">
        <button onClick={handleZoomOut} className="p-1.5 rounded hover:bg-ink-700">
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-sm text-parchment-300 min-w-[50px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button onClick={handleZoomIn} className="p-1.5 rounded hover:bg-ink-700">
          <ZoomIn className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-ink-700" />
        <button onClick={handleRotate} className="p-1.5 rounded hover:bg-ink-700">
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* 图片显示 */}
      <div className="flex-1 overflow-auto p-4 bg-ink-950 flex items-center justify-center">
        {loading && (
          <Loader2 className="w-8 h-8 animate-spin text-gold-400 absolute" />
        )}
        <img
          src={url}
          alt={name}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s ease',
          }}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
        />
      </div>
    </div>
  );
}
