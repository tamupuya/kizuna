import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kizuna.app',
  appName: '绊',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    cleartext: true,
    allowNavigation: [
      'qabhkgrsowxzzewdjkft.supabase.co',
      'map.qq.com',
      '*.qq.com',
      '*.supabase.co',
    ],
  },
  android: {
    backgroundColor: '#ffffff', // 品牌白底，配合 logo
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800, // 启动屏显示时长（ms）
      launchAutoHide: true,    // 启动完成后自动隐藏
      launchFadeOutDuration: 220,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
  },
};

export default config;
