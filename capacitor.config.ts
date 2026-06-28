import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oldz.app',
  appName: 'Old Z',
  webDir: 'dist',
  server: {
    // 生产模式下 app 加载本地 dist 中的文件
    // 开发时可改为你的开发机 IP，如 http://192.168.x.x:5173
    url: undefined,
    cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0f',
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a0a0f',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
    },
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
