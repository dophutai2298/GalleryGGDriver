import { createGalleryHandler } from './gallery.ts'
import { readGalleryConfig } from './config.ts'

// Standard Fetch handler: mount all /api/gallery routes on the same origin as dist/.
// Pass the host's server-only environment bindings. No provider SDK is required.
let handler: ReturnType<typeof createGalleryHandler> | undefined
export default {
  fetch(request: Request, env: Record<string, string | undefined>) {
    handler ??= createGalleryHandler(readGalleryConfig(env))
    return handler(request)
  },
}
