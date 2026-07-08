import { createContext, useCallback, useContext, useState, useMemo, useEffect, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, duration?: number) => void;
  hideToast: (id: string) => void;
}

// 全局 toast 调度 — 允许非 React 代码（如 Zustand store）触发通知
type ToastListener = (type: ToastType, message: string, duration?: number) => void;
let globalToastListener: ToastListener | null = null;

export function setGlobalToastListener(fn: ToastListener | null) {
  globalToastListener = fn;
}

/** 全局 toast 函数 — 可在 store、utils 等非组件代码中调用 */
export const toast = {
  success: (message: string, duration?: number) => globalToastListener?.('success', message, duration),
  error: (message: string, duration?: number) => globalToastListener?.('error', message, duration),
  warning: (message: string, duration?: number) => globalToastListener?.('warning', message, duration),
  info: (message: string, duration?: number) => globalToastListener?.('info', message, duration),
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    
    if (duration > 0) {
      setTimeout(() => hideToast(id), duration);
    }
  }, [hideToast]);

  // 注册全局监听器，让 store 等非组件代码也能调用 toast
  useEffect(() => {
    setGlobalToastListener(showToast);
    return () => setGlobalToastListener(null);
  }, [showToast]);

  const value = useMemo(() => ({
    toasts,
    showToast,
    hideToast,
  }), [toasts, showToast, hideToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

function ToastContainer() {
  const { toasts, hideToast } = useToast();

  if (toasts.length === 0) return null;

  const typeStyles: Record<ToastType, string> = {
    success: 'bg-forest-900/90 text-parchment-100 border-forest-700',
    error: 'bg-red-900/90 text-parchment-100 border-red-700',
    warning: 'bg-gold-900/90 text-parchment-100 border-gold-700',
    info: 'bg-ink-800/90 text-parchment-100 border-ink-700',
  };

  const typeIcons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-in ${typeStyles[toast.type]}`}
          role="alert"
          aria-live="polite"
        >
          <span className="text-lg">{typeIcons[toast.type]}</span>
          <span className="flex-1 text-sm">{toast.message}</span>
          <button
            onClick={() => hideToast(toast.id)}
            className="text-parchment-100/70 hover:text-parchment-100 transition-colors"
            aria-label="关闭通知"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
