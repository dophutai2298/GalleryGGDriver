import { readFile } from 'node:fs/promises'
import type { DriveFile } from '../../server/drive.ts'

const folderMime = 'application/vnd.google-apps.folder'
export function createFakeDrive(options: { localDownloads?: boolean; delay?: number; omitParents?: boolean; rootFailureCycle?: boolean; pageSize?: number } = {}) {
  const files: DriveFile[] = [
    { id: 'root', name: 'Bộ sưu tập', mimeType: folderMime },
    { id: 'sea', name: 'Biển & đảo', mimeType: folderMime, parents: ['root'] },
    { id: 'quiet', name: 'Ngày yên', mimeType: folderMime, parents: ['sea'] },
    { id: 'empty', name: 'Album trống', mimeType: folderMime, parents: ['root'] },
    { id: 'sunrise', name: 'Bình minh.jpg', mimeType: 'image/jpeg', parents: ['root'], thumbnailLink: 'https://lh3.googleusercontent.com/fixture/sunrise=s220', webContentLink: 'https://drive.google.com/uc?export=download&id=sunrise', imageMediaMetadata: { width: 1536, height: 1024 } },
    { id: 'missing', name: 'Ảnh thiếu thumbnail.png', mimeType: 'image/png', parents: ['root'] },
    { id: 'sunset', name: 'Biển chiều.webp', mimeType: 'image/webp', parents: ['sea'], thumbnailLink: 'https://lh3.googleusercontent.com/fixture/sunset=s220', webContentLink: 'https://drive.google.com/uc?export=download&id=sunset' },
    { id: 'calm', name: 'Biển lặng.png', mimeType: 'image/png', parents: ['quiet'], thumbnailLink: 'https://lh3.googleusercontent.com/fixture/calm=s220' },
    { id: 'document', name: 'Bí mật.pdf', mimeType: 'application/pdf', parents: ['root'] },
    { id: 'outside', name: 'Folder ngoài thư viện', mimeType: folderMime },
    { id: 'outside-image', name: 'Không được xem.jpg', mimeType: 'image/jpeg', parents: ['outside'], thumbnailLink: 'https://lh3.googleusercontent.com/fixture/outside=s220' },
  ]
  if (options.localDownloads) {
    // Browser fixtures cover albums beyond the first root page and paginated album photos.
    files.push(
      { id: 'late-album', name: 'Lễ thành hôn', mimeType: folderMime, parents: ['root'] },
      { id: 'sea-missing', name: 'Ảnh thiếu thumbnail.png', mimeType: 'image/png', parents: ['sea'] },
      { id: 'celebration', name: 'Ngày vui.jpg', mimeType: 'image/jpeg', parents: ['sea'], thumbnailLink: 'https://lh3.googleusercontent.com/fixture/celebration=s220', imageMediaMetadata: { width: 1024, height: 1536 } },
    )
    for (const file of files) if (file.webContentLink) file.webContentLink = '/images/gallery-cover.png'
  }
  const calls: URL[] = []
  let rootRequests = 0
  const fakeFetch: typeof fetch = async (input) => {
    if (options.delay) await new Promise((resolve) => setTimeout(resolve, options.delay))
    const url = new URL(input instanceof Request ? input.url : input.toString())
    calls.push(url)
    if (url.hostname === 'lh3.googleusercontent.com') {
      const image = await readFile(new URL('../../public/images/gallery-cover.png', import.meta.url))
      return new Response(new Uint8Array(image), { headers: { 'Content-Type': 'image/png' } })
    }
    if (url.hostname !== 'www.googleapis.com') throw new Error('Unexpected network destination in fixture')
    const id = url.pathname.split('/')[4]
    if (id) {
      if (id === 'root' && options.rootFailureCycle) {
        const step = rootRequests++
        if (step < 2) return Response.json({}, { status: step === 0 ? 500 : 429 })
      }
      const file = files.find((item) => item.id === id)
      return file ? Response.json(options.omitParents ? { ...file, parents: undefined } : file) : Response.json({}, { status: 404 })
    }
    const parent = url.searchParams.get('q')?.match(/^'([^']+)' in parents/)?.[1]
    if (parent === 'broken') return Response.json({ error: { message: 'provider secret should never escape' } }, { status: 500 })
    if (parent === 'limited') return Response.json({}, { status: 429 })
    const children = files.filter((file) => file.parents?.includes(parent ?? '') && !file.trashed && [folderMime, 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType))
    const offset = Number(url.searchParams.get('pageToken') ?? 0)
    const pageSize = options.pageSize ?? 1000
    return Response.json({ files: children.slice(offset, offset + pageSize).map((file) => options.omitParents ? { ...file, parents: undefined } : file), nextPageToken: children.length > offset + pageSize ? String(offset + pageSize) : undefined })
  }
  return { fetch: fakeFetch, files, calls }
}
