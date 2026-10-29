import { GalleryError, IMAGE_MIMES } from './drive.ts'

function trustedMediaUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com'))) {
    throw new GalleryError(404, 'THUMBNAIL_UNAVAILABLE', 'Ảnh xem trước chưa khả dụng. Vui lòng thử lại.')
  }
  return url
}

export function downloadUrl(value: string | undefined, fixture: boolean) {
  if (fixture && value === '/images/gallery-cover.png') return value
  if (value) {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && ['drive.google.com', 'drive.usercontent.google.com', 'docs.google.com'].includes(url.hostname)) return url.href
  }
  throw new GalleryError(404, 'DOWNLOAD_UNAVAILABLE', 'Ảnh gốc không khả dụng hoặc chưa được cho phép tải xuống.')
}

export async function fetchThumbnail(value: string | undefined, preview: boolean, transport: typeof fetch) {
  if (!value) throw new GalleryError(404, 'THUMBNAIL_UNAVAILABLE', 'Ảnh xem trước chưa khả dụng. Vui lòng thử lại.')
  let url = trustedMediaUrl(value)
  // Drive's image CDN supports sized thumbnails; never request alt=media originals.
  url.pathname = url.pathname.replace(/=s\d+(?:-[a-z]+)?$/, preview ? '=s1600' : '=s400')
  const timeout = AbortSignal.timeout(15_000)
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await transport(url, { redirect: 'manual', signal: timeout })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const target = response.headers.get('Location')
      await response.body?.cancel()
      if (!target) break
      url = trustedMediaUrl(new URL(target, url).href)
      continue
    }
    const type = response.headers.get('Content-Type')?.split(';')[0].trim() ?? ''
    const maxBytes = 8 * 1024 * 1024
    if (!response.ok || !IMAGE_MIMES.has(type) || Number(response.headers.get('Content-Length')) > maxBytes) {
      await response.body?.cancel()
      if (response.status === 429) throw new GalleryError(429, 'RATE_LIMITED', 'Ảnh đang được xem nhiều. Vui lòng thử lại sau ít phút.')
      break
    }
    const reader = response.body?.getReader()
    if (!reader) break
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { value: chunk, done } = await reader.read()
      if (done) break
      total += chunk.byteLength
      if (total > maxBytes) { await reader.cancel(); throw new GalleryError(413, 'THUMBNAIL_UNAVAILABLE', 'Ảnh xem trước quá lớn. Vui lòng thử ảnh khác.') }
      chunks.push(chunk)
    }
    if (!total) break
    const bytes = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return { bytes, type }
  }
  throw new GalleryError(404, 'THUMBNAIL_UNAVAILABLE', 'Ảnh xem trước đã hết hạn hoặc chưa khả dụng. Vui lòng thử lại.')
}
