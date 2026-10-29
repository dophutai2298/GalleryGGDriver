import { createGalleryHandler } from '../server/gallery.ts'
import { readGalleryConfig } from '../server/config.ts'

// Deliberate, manual live smoke check. Routine tests use fixtures, never this folder.
const handler = createGalleryHandler(readGalleryConfig(process.env))
async function read(path) {
  const response = await handler(new Request(`http://localhost${path}`))
  const body = await response.json()
  if (!response.ok) throw new Error(`${response.status} ${body.error?.code ?? 'UNAVAILABLE'}: ${body.error?.message ?? ''}`)
  return body
}
try {
  const root = await read('/api/gallery')
  console.log(`Root: OK; ${root.folders.length} folders; ${root.images.length} photos on first page`)
  const queue = [...root.folders]
  let image
  for (let visited = 0; !image && queue.length && visited < 12; visited++) {
    const folder = queue.shift()
    const page = await read(`/api/gallery?folder=${encodeURIComponent(folder.id)}`)
    queue.push(...page.folders)
    // Some real files have no generated thumbnail; inspect a representative one too.
    for (const candidate of page.images.slice(0, 5)) {
      const probe = await handler(new Request(`http://localhost${candidate.thumbnailUrl}`))
      await probe.body?.cancel()
      if (probe.ok) { image = candidate; break }
    }
  }
  if (!image) { console.log('No photo found in the first 12 folders; thumbnail/download checks not performed.'); process.exitCode = 1 }
  else {
    const thumbnail = await handler(new Request(`http://localhost${image.thumbnailUrl}`))
    console.log(`Thumbnail: ${thumbnail.status}; type: ${thumbnail.headers.get('Content-Type')}; bytes: ${(await thumbnail.arrayBuffer()).byteLength}`)
    const download = await handler(new Request(`http://localhost/api/gallery/images/${encodeURIComponent(image.id)}/download`))
    console.log(`Original download link: ${download.status} (original binary is not fetched)`)
    if (!thumbnail.ok || !download.ok) process.exitCode = 1
  }
} catch (error) { console.error(error instanceof Error ? error.message : 'Live check failed'); process.exitCode = 1 }
