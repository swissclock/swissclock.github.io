import { defineConfig } from 'vite'
import { fillSlots, slots } from './src/content/render.js'

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
    sourcemap: false
  },
  server: { port: 5173, host: true }
})

export { slots }
