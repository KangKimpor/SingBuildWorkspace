import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

const buildVersion = `${(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'build').slice(0, 12)}-${Date.now().toString(36)}`

function versionManifestPlugin(version: string): Plugin {
  const payload = JSON.stringify({ version })
  return {
    name: 'app-version-manifest',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: payload })
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
        res.end(payload)
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    versionManifestPlugin(buildVersion),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['brand/favicon.svg', 'brand/apple-touch-icon.png'],
      manifest: {
        name: 'SingBuild Workspace',
        short_name: 'SingBuild',
        description: 'Pages and tasks in one workspace.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        theme_color: '#ffffff',
        background_color: '#ffffff',
        icons: [
          { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/brand/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Workspace', short_name: 'Workspace', url: '/' },
        ],
      },
      workbox: {
        clientsClaim: true,
        // Never precache HTML or version.json so every refresh/open fetches the newest entry document from the network.
        globPatterns: ['**/*.{js,css,svg,png,webmanifest,woff2}'],
        globIgnores: ['**/index.html', '**/version.json'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2022', cssMinify: true, manifest: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
