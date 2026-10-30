import type { IncomingMessage, ServerResponse } from 'node:http'

export function nodeMiddleware(handler: (request: Request) => Promise<Response>) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const request = new Request(new URL(req.url ?? '/', 'http://localhost'), { method: req.method ?? 'GET' })
      const response = await handler(request)
      if (res.destroyed) return
      res.statusCode = response.status
      response.headers.forEach((value, name) => res.setHeader(name, value))
      res.end(Buffer.from(await response.arrayBuffer()))
    } catch {
      if (res.destroyed) return
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Thư viện tạm thời không khả dụng. Vui lòng thử lại.' } }))
    }
  }
}
