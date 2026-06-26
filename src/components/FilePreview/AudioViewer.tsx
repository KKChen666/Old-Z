import { Music } from 'lucide-react';

interface AudioViewerProps {
  url: string;
  name: string;
}

export default function AudioViewer({ url, name }: AudioViewerProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-ink-950 p-8">
      <div className="w-32 h-32 rounded-full bg-ink-800 flex items-center justify-center">
        <Music className="w-16 h-16 text-gold-400" />
      </div>
      <p className="text-parchment-200 text-sm text-center max-w-md truncate">
        {name}
      </p>
      <audio src={url} controls autoPlay={false} className="w-full max-w-md">
        您的浏览器不支持音频播放
      </audio>
    </div>
  );
}
