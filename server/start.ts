import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { createGalleryHandler } from './gallery.ts'
import { readGalleryConfig } from './config.ts'
import { nodeMiddleware } from './node-adapter.ts'

const gallery = nodeMiddleware(createGalleryHandler(readGalleryConfig(process.env)))
const root = resolve('dist')
const contentTypes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }

const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/')) { await gallery(req, res); return }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return }
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    const filePath = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`)
    const within = relative(root, filePath)
    if (within.startsWith('..') || isAbsolute(within)) { res.writeHead(404).end(); return }
    const file = await readFile(filePath)
    res.writeHead(200, { 'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' })
    res.end(req.method === 'HEAD' ? undefined : file)
  } catch { res.writeHead(404).end('Không tìm thấy trang.') }
})

const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535')
server.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log(`Frame Image: http://127.0.0.1:${port}`))
