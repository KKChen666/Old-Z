import { ensureHttps } from '@/lib/utils';

interface HtmlViewerProps {
  url: string;
  name: string;
}

// 在沙箱 iframe 中渲染 HTML 文件，支持脚本执行但隔离于宿主应用，
// 防止上传的任意 HTML 访问父页面的 DOM / Cookie。
export default function HtmlViewer({ url, name }: HtmlViewerProps) {
  return (
    <div className="h-full w-full bg-white">
      <iframe
        src={ensureHttps(url)}
        title={name}
        sandbox="allow-scripts allow-popups allow-forms allow-modals"
        referrerPolicy="no-referrer"
        className="h-full w-full border-0"
      />
    </div>
  );
}
