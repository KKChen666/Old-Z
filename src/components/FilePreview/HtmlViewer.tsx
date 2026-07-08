import { useState, useEffect, useRef, useCallback } from 'react';
import { ensureHttps } from '@/lib/utils';
import { fetchFileAsText } from './fileLoader';
import { Loader2, Play, Code2, Monitor, Columns2, RotateCcw, AlertTriangle } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { oneDark } from '@codemirror/theme-one-dark';

interface HtmlViewerProps {
  url: string;
  name: string;
}

export default function HtmlViewer({ url, name }: HtmlViewerProps) {
  const [code, setCode] = useState('');
  const [editedCode, setEditedCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [layout, setLayout] = useState<'split' | 'code' | 'preview'>('split');
  const [splitRatio, setSplitRatio] = useState(50);
  const [runKey, setRunKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 加载 HTML 文件内容
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const text = await fetchFileAsText(url);
        if (cancelled) return;
        if (!text || !text.trim()) {
          setError('文件内容为空');
          setLoading(false);
          return;
        }
        const trimmed = text.trim();
        setCode(trimmed);
        setEditedCode(trimmed);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || '加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  // 编辑时防抖自动刷新预览
  const handleCodeChange = useCallback((value: string) => {
    setEditedCode(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRunKey((k) => k + 1);
    }, 500);
  }, []);

  const handleRun = useCallback(() => {
    setRunKey((k) => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    setEditedCode(code);
    setRunKey((k) => k + 1);
  }, [code]);

  // 分隔条拖拽
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const startX = e.clientX;
    const startRatio = splitRatio;
    const containerWidth = containerRef.current?.offsetWidth || 800;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newRatio = Math.min(80, Math.max(20, startRatio + (dx / containerWidth) * 100));
      setSplitRatio(newRatio);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [splitRatio]);

  const isModified = editedCode !== code;

  if (loading) {
    return (
      <div className="h-full w-full bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-ink-400" />
          <span className="text-xs text-ink-500">加载 HTML...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <p className="text-sm text-ink-700 font-medium">无法加载此 HTML</p>
          <p className="text-xs text-ink-400">{error}</p>
          <a
            href={ensureHttps(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gold-500 hover:text-gold-400 underline"
          >
            在新窗口打开
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-white" ref={containerRef}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLayout('split')}
            className={`p-1.5 rounded text-xs transition-colors ${
              layout === 'split'
                ? 'bg-gold-400/20 text-gold-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="分栏视图（代码 + 预览）"
          >
            <Columns2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayout('code')}
            className={`p-1.5 rounded text-xs transition-colors ${
              layout === 'code'
                ? 'bg-gold-400/20 text-gold-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="仅代码"
          >
            <Code2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLayout('preview')}
            className={`p-1.5 rounded text-xs transition-colors ${
              layout === 'preview'
                ? 'bg-gold-400/20 text-gold-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="仅预览"
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {isModified && (
            <span className="text-[10px] text-amber-500 mr-1 hidden sm:inline">已修改</span>
          )}
          {isModified && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="重置为原始内容"
            >
              <RotateCcw className="w-3 h-3" />
              重置
            </button>
          )}
          <button
            onClick={handleRun}
            className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-gold-400/15 text-gold-600 border border-gold-400/25 hover:bg-gold-400/25 transition-colors"
            title="运行（Ctrl+Enter）"
          >
            <Play className="w-3 h-3" />
            运行
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
        {/* 代码面板 */}
        {(layout === 'split' || layout === 'code') && (
          <div
            className={`flex flex-col border-r border-gray-200 overflow-hidden ${
              layout === 'split' ? 'h-1/2 sm:h-full' : 'h-full'
            }`}
            style={layout === 'split' ? { width: `${splitRatio}%` } : { flex: 1 }}
          >
            <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
              <Code2 className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">HTML</span>
              {isModified && <span className="text-[10px] text-amber-500">· 已修改</span>}
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <CodeMirror
                value={editedCode}
                onChange={handleCodeChange}
                extensions={[
                  html({ matchClosingTags: true, autoCloseTags: true }),
                  javascript(),
                  css(),
                  oneDark,
                ]}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: false,
                  foldGutter: true,
                  autocompletion: true,
                  indentOnInput: true,
                  bracketMatching: true,
                  closeBrackets: true,
                  tabSize: 2,
                }}
                theme="dark"
                height="100%"
                style={{ height: '100%', fontSize: '13px' }}
                placeholder="HTML 内容..."
              />
            </div>
          </div>
        )}

        {/* 分隔条 */}
        {layout === 'split' && (
          <div
            className="hidden sm:flex w-1.5 cursor-col-resize bg-gray-100 hover:bg-gold-300/40 active:bg-gold-400/50 transition-colors flex-shrink-0 items-center justify-center"
            onMouseDown={handleDividerMouseDown}
          >
            <div className="w-0.5 h-8 rounded-full bg-gray-300" />
          </div>
        )}

        {/* 预览面板 */}
        {(layout === 'split' || layout === 'preview') && (
          <div className={layout === 'split' ? 'flex-1 flex flex-col min-w-0' : 'flex-1 flex flex-col'}>
            <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-100 bg-gray-50/50 flex-shrink-0">
              <Monitor className="w-3 h-3 text-gray-400" />
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">预览</span>
            </div>
            <div className="flex-1 min-h-0 bg-white">
              <iframe
                key={runKey}
                srcDoc={editedCode}
                title={`预览: ${name}`}
                sandbox="allow-scripts allow-popups allow-forms allow-modals allow-same-origin"
                referrerPolicy="no-referrer"
                className="h-full w-full border-0"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
