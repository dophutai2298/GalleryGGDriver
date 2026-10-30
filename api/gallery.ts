import { createGalleryHandler } from '../server/gallery.ts'
import { readGalleryConfig } from '../server/config.ts'

// Vercel discovers functions in api/; environment variables stay in the Node runtime.
const gallery = createGalleryHandler(readGalleryConfig(process.env))

export default {
  fetch(request: Request) {
    return gallery(request)
  },
}
