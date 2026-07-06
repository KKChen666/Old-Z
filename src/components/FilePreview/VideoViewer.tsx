import { ensureHttps } from '@/lib/utils';

interface VideoViewerProps {
  url: string;
  name: string;
}

export default function VideoViewer({ url, name }: VideoViewerProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-black">
      <video
        src={ensureHttps(url)}
        controls
        autoPlay={false}
        className="max-w-full max-h-full"
        style={{ maxHeight: '80vh' }}
      >
        您的浏览器不支持视频播放
      </video>
    </div>
  );
}
