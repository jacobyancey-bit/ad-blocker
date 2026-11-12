import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';
import { SUPPORTED_MATCHES } from './src/shared/constants';

export default defineManifest({
  manifest_version: 3,
  name: 'AdMute',
  short_name: 'AdMute',
  version: pkg.version,
  description: pkg.description,
  minimum_chrome_version: '116',

  permissions: ['storage', 'activeTab', 'scripting'],
  host_permissions: [...SUPPORTED_MATCHES],
  // Users can opt in to extra sites at runtime (requested from the popup).
  optional_host_permissions: ['https://*/*'],

  background: {
    service_worker: 'src/background/serviceWorker.ts',
    type: 'module',
  },

  content_scripts: [
    {
      matches: [...SUPPORTED_MATCHES],
      js: ['src/content/index.iife.ts'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],

  action: {
    default_title: 'AdMute',
    default_popup: 'src/popup/index.html',
  },

  web_accessible_resources: [
    {
      resources: ['sounds/*.mp3'],
      matches: ['<all_urls>'],
    },
  ],

  commands: {
    'toggle-detection': {
      suggested_key: { default: 'Alt+Shift+M' },
      description: 'Pause / resume ad muting on the current tab',
    },
  },
});

