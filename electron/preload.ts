import { contextBridge, ipcRenderer } from 'electron';

// Expose minimal API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,

  // 开机自启控制
  setAutoStart: (enabled: boolean) => ipcRenderer.invoke('set-auto-start', enabled),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),

  // 全局快捷键设置
  setGlobalShortcut: (shortcut: string | null) => ipcRenderer.invoke('set-global-shortcut', shortcut),

  // 窗口切换事件监听
  onToggleWindow: (callback: () => void) => {
    ipcRenderer.on('toggle-window', () => callback());
  },
});
