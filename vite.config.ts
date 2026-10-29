import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createGalleryHandler } from './server/gallery'
import { readGalleryConfig } from './server/config'
import { nodeMiddleware } from './server/node-adapter'

export default defineConfig(async ({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const fixture = mode === 'fixture' || mode === 'fixture-failure'
  const config = fixture
    ? { apiKey: 'fixture-key-never-a-real-secret', rootFolderId: 'root', fixture: true, fetch: (await import('./tests/fixtures/drive')).createFakeDrive({ localDownloads: true, delay: 120, omitParents: true, pageSize: 3, rootFailureCycle: mode === 'fixture-failure' }).fetch }
    : readGalleryConfig(env)
  const api = nodeMiddleware(createGalleryHandler(config))
  const middleware = (server: { middlewares: { use: (fn: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => void) => void } }) => {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/api/')) void api(req, res)
      else next()
    })
  }
  return { plugins: [react(), { name: 'gallery-api', configureServer: middleware, configurePreviewServer: middleware }] }
})
