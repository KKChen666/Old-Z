import { Capacitor } from '@capacitor/core';

/**
 * 本地模式只在具备原生容器的客户端开放。
 * Web 浏览器（包括移动端浏览器）始终使用在线模式。
 */
export function supportsLocalMode(): boolean {
  if (typeof window === 'undefined') return false;

  const isWindowsDesktop = window.electronAPI?.isElectron === true
    && window.electronAPI.platform === 'win32';

  return isWindowsDesktop || Capacitor.isNativePlatform();
}

export function isLocalModeActive(): boolean {
  return supportsLocalMode() && localStorage.getItem('old-z-local-mode') === 'true';
}
