import { createGalleryHandler } from '../server/gallery.ts'
import { readGalleryConfig } from '../server/config.ts'

// Deliberate, manual smoke check. A URL checks deployed HTTP routes; no URL checks the local handler.
// Server credentials are never forwarded to the deployment. Routine tests use fixtures.
const target = process.argv[2] ? new URL(process.argv[2]) : null
if (target && (target.username || target.password || (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname))))) {
  throw new Error('Use an HTTPS deployment URL or a local HTTP server URL without credentials.')
}
const handler = target
  ? (request) => fetch(request, { redirect: 'error', signal: AbortSignal.timeout(60_000) })
  : createGalleryHandler(readGalleryConfig(process.env))
const request = (path) => handler(new Request(new URL(path, target?.origin ?? 'http://localhost')))
async function read(path) {
  const response = await request(path)
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    await response.body?.cancel()
    const platformError = response.headers.get('x-vercel-error')
    throw new Error(`${response.status} ${platformError ? `Vercel ${platformError}` : 'NON_JSON_RESPONSE'} at ${path}. Check deployment routing; expected gallery API JSON.`)
  }
  const body = await response.json()
  if (!response.ok) throw new Error(`${response.status} ${body.error?.code ?? 'UNAVAILABLE'}: ${body.error?.message ?? ''}`)
  return body
}
try {
  if (target) {
    const home = await request('/')
    await home.body?.cancel()
    if (!home.ok || !home.headers.get('Content-Type')?.includes('text/html')) throw new Error(`Homepage: ${home.status}; expected gallery HTML.`)
    console.log(`Homepage: ${home.status}; target: ${target.origin}`)
  }
  const root = await read('/api/gallery')
  if (!root.folder?.id || !Array.isArray(root.folders) || !Array.isArray(root.images)) throw new Error('Gallery API returned an unexpected response shape.')
  console.log(`Root: OK; ${root.folders.length} folders; ${root.images.length} photos on first page`)
  const queue = [root.folder]
  let image
  for (let visited = 0; !image && queue.length && visited < 12; visited++) {
    const folder = queue.shift()
    const page = visited === 0 ? root : await read(`/api/gallery?folder=${encodeURIComponent(folder.id)}`)
    queue.push(...page.folders)
    // Some real files have no generated thumbnail; inspect a representative one too.
    for (const candidate of page.images.slice(0, 5)) {
      const probe = await request(candidate.thumbnailUrl)
      await probe.body?.cancel()
      if (probe.ok) { image = candidate; break }
    }
  }
  if (!image) { console.log('No photo found in the first 12 folders; thumbnail/download checks not performed.'); process.exitCode = 1 }
  else {
    const thumbnail = await request(image.thumbnailUrl)
    console.log(`Thumbnail: ${thumbnail.status}; type: ${thumbnail.headers.get('Content-Type')}; bytes: ${(await thumbnail.arrayBuffer()).byteLength}`)
    const preview = await request(image.previewUrl)
    console.log(`Preview: ${preview.status}; type: ${preview.headers.get('Content-Type')}; bytes: ${(await preview.arrayBuffer()).byteLength}`)
    const download = await read(`/api/gallery/images/${encodeURIComponent(image.id)}/download`)
    if (typeof download.url !== 'string') throw new Error('Original download link missing from API response.')
    console.log('Original download link: OK (original binary is not fetched)')
    if (!thumbnail.ok || !preview.ok || !thumbnail.headers.get('Content-Type')?.startsWith('image/') || !preview.headers.get('Content-Type')?.startsWith('image/')) process.exitCode = 1
  }
} catch (error) { console.error(error instanceof Error ? error.message : 'Live check failed'); process.exitCode = 1 }
