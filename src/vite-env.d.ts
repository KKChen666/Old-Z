/// <reference types="vite/client" />

interface ElectronAPI {
  platform: NodeJS.Platform;
  isElectron: true;
  setAutoStart: (enabled: boolean) => Promise<boolean>;
  getAutoStart: () => Promise<boolean>;
  setGlobalShortcut: (shortcut: string | null) => Promise<boolean>;
  onToggleWindow: (callback: () => void) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
