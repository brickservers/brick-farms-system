import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(async () => {
  // Dynamically import the React plugin to avoid ESM/CJS interop issues in
  // environments that attempt to require the config. Async import ensures the
  // ESM-only plugin is loaded as an ES module.
  const reactPlugin = (await import('@vitejs/plugin-react')).default

  return {
    plugins: [
      reactPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icons/*'],
        manifest: {
          name: 'BrickFarms Digital Agricultural Platform',
          short_name: 'BrickFarms DAP',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#184914'
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /\/api\//,
              handler: 'NetworkFirst',
              options: { cacheName: 'api-cache' }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'CacheFirst',
              options: { cacheName: 'image-cache' }
            }
          ]
        }
      })
    ],
    server: {
      // Bind explicitly to IPv4 wildcard so the dev server is reachable from
      // the host system (useful when running inside WSL2 or other VM-like
      // environments). Using '0.0.0.0' ensures IPv4 connections (not ::1).
      host: '0.0.0.0',
      port: 5173,
      // Dev proxy: route API calls to a remote staging backend. Configure the
      // target by setting the environment variable VITE_API_URL when running
      // the dev server. Example:
      //   VITE_API_URL=https://staging.example.com npm run dev
      // The proxy will forward /api/* (and /ws for websockets) to the target.
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://staging.example.com',
          changeOrigin: true,
          secure: false,
          ws: true
        },
        '/ws': {
          target: process.env.VITE_API_URL || 'http://staging.example.com',
          changeOrigin: true,
          secure: false,
          ws: true
        }
      }
    }
  }
})
