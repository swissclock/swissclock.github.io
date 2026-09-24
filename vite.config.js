import { defineConfig } from 'vite'
import { fillSlots } from './src/content/render.js'
import { site } from './src/content/data.js'

const SITE = site.url

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
    /**
     * robots.txt and sitemap.xml are emitted rather than committed, so the
     * sitemap's lastmod is the date of the build that produced it and cannot
     * drift away from the content it describes.
     */
    generateBundle () {
      const today = new Date().toISOString().slice(0, 10)
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: [
          'User-agent: *',
          'Allow: /',
          '',
          `Sitemap: ${SITE}sitemap.xml`,
          ''
        ].join('\n')
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          '  <url>',
          `    <loc>${SITE}</loc>`,
          `    <lastmod>${today}</lastmod>`,
          '    <changefreq>monthly</changefreq>',
          '  </url>',
          '</urlset>',
          ''
        ].join('\n')
      })
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
