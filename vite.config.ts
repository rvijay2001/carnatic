import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed to GitHub Pages at /carnatic/ — see docs/ARCHITECTURE.md.
export default defineConfig({
  base: '/carnatic/',
  define: {
    // Shown in the app footer so we can tell which build a device runs
    // (iOS service-worker update lag diagnosis — see docs/BACKLOG.md).
    __BUILD_TIME__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z',
    ),
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Carnatic Practice',
        short_name: 'Carnatic',
        description: 'Personal Carnatic music practice companion',
        start_url: '/carnatic/',
        scope: '/carnatic/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
