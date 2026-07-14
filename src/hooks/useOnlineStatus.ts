import { useState, useEffect, useCallback } from 'react';

/**
 * 在线状态检测 Hook。
 * 结合 navigator.onLine 和周期性健康检查。
 */
export function useOnlineStatus(options?: {
  /** 健康检查间隔（毫秒），默认 30000 */
  checkIntervalMs?: number;
  /** 健康检查端点 */
  healthEndpoint?: string;
}) {
  const { checkIntervalMs = 30000, healthEndpoint = '/api/health' } = options || {};
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const checkHealth = useCallback(async () => {
    try {
      const base = localStorage.getItem('old-z-api-base') || '/api';
      const url = healthEndpoint.startsWith('/')
        ? `${base}${healthEndpoint}`
        : healthEndpoint;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache',
      });
      clearTimeout(timer);

      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    }
  }, [healthEndpoint]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      checkHealth(); // 确认后端也可达
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 周期性健康检查
    const interval = setInterval(checkHealth, checkIntervalMs);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkHealth, checkIntervalMs]);

  return { isOnline, checkHealth };
}
