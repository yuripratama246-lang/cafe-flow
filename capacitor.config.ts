import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cafeflow.pos',
  appName: 'Cafe Flow',
  webDir: 'www',
  server: {
    url: 'https://pos.yuripratama246.workers.dev',
    cleartext: false
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
