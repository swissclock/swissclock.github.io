import { defineConfig } from 'vite'
import { fillSlots } from './src/content/render.js'

/**
 * Renders the content from src/content/data.js into index.html, in dev and in
 * the build, so the page ships real text rather than an empty shell.
 */
function content () {
  return {
    name: 'swissa-content',
    transformIndexHtml: {
      order: 'pre',
      handler (html) {
        return fillSlots(html)
      }
    },
    handleHotUpdate ({ file, server }) {
      if (file.includes('/src/content/')) {
        server.ws.send({ type: 'full-reload' })
        return []
      }
    }
  }
}

export default defineConfig({
  base: '/',
  plugins: [content()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 2048,
    sourcemap: false,
    // three's WebGLRenderer and shader library are the whole of the scene chunk
    // and neither is tree-shakeable; the chunk is already split off the entry
    // and loaded after first paint, so the default 500 kB warning is only noise.
    chunkSizeWarningLimit: 600
  },
  server: { port: 5173, host: true }
})
