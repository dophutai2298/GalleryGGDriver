import type { GalleryPage, GalleryPhoto } from '../src/gallery-types.ts'
import { createDriveClient, FOLDER_MIME, IMAGE_MIMES, GalleryError } from './drive.ts'
import type { DriveFile, GalleryConfig } from './drive.ts'
import { downloadUrl, fetchThumbnail } from './media.ts'

export function createGalleryHandler(config: GalleryConfig) {
  const drive = createDriveClient(config)
  let searchSnapshot: { images: GalleryPhoto[]; expires: number } | undefined
  let pendingSearch: Promise<GalleryPhoto[]> | undefined
  const thumbnails = new Map<string, { bytes: Uint8Array; type: string; expires: number }>()
  let thumbnailBytes = 0
  const pendingThumbnails = new Map<string, ReturnType<typeof fetchThumbnail>>()
  const paths = new Map<string, DriveFile[]>()

  function encodeCursor(scope: string, position: string) {
    return btoa(JSON.stringify({ scope: encodeURIComponent(scope), position }))
  }

  function readCursor(value: string | null, scope: string) {
    if (!value) return undefined
    try {
      if (value.length > 8000) throw new Error()
      const parsed = JSON.parse(atob(value)) as { scope?: string; position?: string }
      if (parsed.scope !== encodeURIComponent(scope) || typeof parsed.position !== 'string') throw new Error()
      return parsed.position
    } catch {
      throw new GalleryError(400, 'INVALID_CURSOR', 'Trang ảnh không hợp lệ. Vui lòng tải lại folder.')
    }
  }

  function normalize(value: string) {
    return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('vi').replace(/đ/g, 'd')
  }

  function validId(value: string) {
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(value)) throw new GalleryError(400, 'INVALID_REQUEST', 'Đường dẫn thư viện không hợp lệ.')
    return value
  }

  function rememberChildren(path: DriveFile[], files: DriveFile[]) {
    for (const file of files) if (!file.trashed && (file.mimeType === FOLDER_MIME || IMAGE_MIMES.has(file.mimeType))) {
      validId(file.id)
      paths.set(file.id, [...path, file])
    }
    while (paths.size > 50_000) paths.delete(paths.keys().next().value!)
  }

  async function* children(path: DriveFile[], fresh = false) {
    let token: string | undefined
    const pageTokens = new Set<string>()
    const started = Date.now()
    do {
      if (Date.now() - started > 45_000) throw new GalleryError(503, 'SEARCH_LIMIT', 'Thư viện đang mất nhiều thời gian để phản hồi. Vui lòng thử lại sau.')
      const page = await drive.listFiles(path[path.length - 1].id, token, fresh)
      rememberChildren(path, page.files)
      yield page.files
      token = page.nextPageToken
      if (token && pageTokens.has(token)) throw new GalleryError(502, 'DRIVE_UNAVAILABLE', 'Không thể đọc tiếp trang ảnh. Vui lòng thử lại.')
      if (token) pageTokens.add(token)
    } while (token)
  }

  async function verifyPath(root: DriveFile, hint: DriveFile[], fresh: boolean) {
    const verified = [root]
    for (const expected of hint.slice(1)) {
      let found: DriveFile | undefined
      for await (const files of children(verified, fresh)) {
        found = files.find((file) => file.id === expected.id && !file.trashed)
        if (found) break
      }
      if (!found) return undefined
      verified.push(found)
      if (expected !== hint[hint.length - 1] && found.mimeType !== FOLDER_MIME) return undefined
    }
    return verified
  }

  async function pathTo(id: string, fresh = false): Promise<DriveFile[]> {
    validId(id)
    const root = await drive.getFile(config.rootFolderId, fresh)
    if (root.mimeType !== FOLDER_MIME || root.trashed) throw new GalleryError(404, 'NOT_FOUND', 'Folder thư viện không khả dụng.')
    if (id === root.id) return [root]
    const known = paths.get(id)
    if (known) {
      const verified = await verifyPath(root, known, fresh)
      if (verified) return verified
      paths.delete(id)
      searchSnapshot = undefined
    }
    // Public metadata can omit parents. Only listings rooted in this gallery prove membership.
    for await (const files of children([root], fresh)) {
      const direct = files.find((file) => file.id === id && !file.trashed)
      if (direct) return [root, direct]
    }
    await scanTree(root)
    const discovered = paths.get(id)
    if (discovered) {
      const verified = await verifyPath(root, discovered, fresh)
      if (verified) return verified
    }
    throw new GalleryError(404, 'NOT_FOUND', 'Không tìm thấy nội dung trong thư viện này.')
  }

  function photo(file: DriveFile, location: { id: string; name: string }[]): GalleryPhoto {
    const media = `/api/gallery/images/${encodeURIComponent(file.id)}`
    return {
      id: file.id, name: file.name, mimeType: file.mimeType, location: location.map(({ id, name }) => ({ id, name })),
      modifiedTime: file.modifiedTime, width: file.imageMediaMetadata?.width, height: file.imageMediaMetadata?.height,
      thumbnailUrl: `${media}/thumbnail`, previewUrl: `${media}/preview`,
      downloadable: !!file.webContentLink && file.capabilities?.canDownload !== false,
    }
  }

  async function scanTree(root: DriveFile) {
    if (searchSnapshot && searchSnapshot.expires > Date.now()) return searchSnapshot.images
    if (pendingSearch) return pendingSearch
    pendingSearch = (async () => {
      const images: GalleryPhoto[] = []
      const queue = [{ folder: root, path: [root] }]
      const visited = new Set<string>()
      const started = Date.now()
      let entries = 0
      while (queue.length) {
        const batch = queue.splice(0, 4)
        await Promise.all(batch.map(async ({ folder, path }) => {
          if (visited.has(folder.id)) return
          visited.add(folder.id)
          for await (const files of children(path)) {
            if (Date.now() - started > 45_000 || entries > 50_000) throw new GalleryError(503, 'SEARCH_LIMIT', 'Thư viện đang mất nhiều thời gian để tìm kiếm. Vui lòng thử lại sau.')
            for (const file of files) {
              entries++
              if (entries > 50_000) throw new GalleryError(503, 'SEARCH_LIMIT', 'Thư viện vượt giới hạn tìm kiếm hiện tại. Vui lòng thử lại sau.')
              if (file.trashed) continue
              if (file.mimeType === FOLDER_MIME) {
                if (path.length >= 64) throw new GalleryError(503, 'SEARCH_LIMIT', 'Cấu trúc thư mục quá sâu để tìm kiếm đầy đủ.')
                queue.push({ folder: file, path: [...path, file] })
              }
              else if (IMAGE_MIMES.has(file.mimeType)) images.push(photo(file, path))
            }
          }
        }))
      }
      images.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      searchSnapshot = { images, expires: Date.now() + 30_000 }
      return images
    })()
    try { return await pendingSearch } finally { pendingSearch = undefined }
  }

  return async (request: Request): Promise<Response> => {
    try {
      if (!config.apiKey || !config.rootFolderId) throw new GalleryError(503, 'NOT_CONFIGURED', 'Thư viện đang được chuẩn bị. Vui lòng quay lại sau.')
      if (request.method !== 'GET') return Response.json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Thao tác không được hỗ trợ.' } }, { status: 405, headers: { Allow: 'GET' } })
      const url = new URL(request.url)
      const imageRoute = url.pathname.match(/^\/api\/gallery\/images\/([A-Za-z0-9_-]{1,200})\/(thumbnail|preview|download)$/)
      if (imageRoute) {
        const [, id, action] = imageRoute
        const retry = Number(url.searchParams.get('retry') ?? 0) > 0
        const path = await pathTo(id, retry)
        const file = path[path.length - 1]
        if (!IMAGE_MIMES.has(file.mimeType)) throw new GalleryError(404, 'NOT_FOUND', 'Định dạng ảnh không được hỗ trợ.')
        if (action === 'download') {
          if (file.capabilities?.canDownload === false) throw new GalleryError(404, 'DOWNLOAD_UNAVAILABLE', 'Ảnh này chưa được cho phép tải xuống.')
          return Response.json({ url: downloadUrl(file.webContentLink, !!config.fixture) }, { headers: { 'Cache-Control': 'no-store' } })
        }
        const key = `${id}:${action}`
        let media = thumbnails.get(key)
        if (media && (media.expires <= Date.now() || retry)) { thumbnails.delete(key); thumbnailBytes -= media.bytes.byteLength; media = undefined }
        if (!media) {
          let pending = pendingThumbnails.get(key)
          if (!pending) {
            pending = fetchThumbnail(file.thumbnailLink, action === 'preview', config.fetch ?? fetch)
            pendingThumbnails.set(key, pending)
          }
          let fetched: Awaited<typeof pending>
          try { fetched = await pending } finally { if (pendingThumbnails.get(key) === pending) pendingThumbnails.delete(key) }
          media = { ...fetched, expires: Date.now() + 30_000 }
          const replaced = thumbnails.get(key)
          if (replaced) thumbnailBytes -= replaced.bytes.byteLength
          thumbnails.set(key, media)
          thumbnailBytes += media.bytes.byteLength
          while (thumbnailBytes > 32 * 1024 * 1024 || thumbnails.size > 128) {
            const oldest = thumbnails.keys().next().value!
            thumbnailBytes -= thumbnails.get(oldest)!.bytes.byteLength
            thumbnails.delete(oldest)
          }
        }
        return new Response(new Uint8Array(media.bytes), { headers: { 'Content-Type': media.type, 'Cache-Control': 'public, max-age=30', 'X-Content-Type-Options': 'nosniff' } })
      }
      if (url.pathname !== '/api/gallery') throw new GalleryError(404, 'NOT_FOUND', 'Đường dẫn không tồn tại.')
      const query = url.searchParams.get('q')?.trim() ?? ''
      if (query.length > 200) throw new GalleryError(400, 'INVALID_REQUEST', 'Tên ảnh cần tìm quá dài.')
      if (query) {
        const rootPath = await pathTo(config.rootFolderId)
        const root = { id: rootPath[0].id, name: rootPath[0].name }
        const offset = Number(readCursor(url.searchParams.get('cursor'), `search:${query}`) ?? 0)
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 50_000) throw new GalleryError(400, 'INVALID_CURSOR', 'Trang tìm kiếm không hợp lệ.')
        const matches = (await scanTree(rootPath[0])).filter((image) => normalize(image.name).includes(normalize(query)))
        const body: GalleryPage = {
          folder: root, breadcrumbs: [root], folders: [], images: matches.slice(offset, offset + 200),
          nextCursor: matches.length > offset + 200 ? encodeCursor(`search:${query}`, String(offset + 200)) : null,
          mode: config.fixture ? 'fixture' : 'live',
        }
        return Response.json(body, { headers: { 'Cache-Control': 'no-store' } })
      }
      const path = await pathTo(url.searchParams.get('folder') || config.rootFolderId, true)
      const folder = path[path.length - 1]
      if (folder.mimeType !== FOLDER_MIME) throw new GalleryError(404, 'NOT_FOUND', 'Folder thư viện không khả dụng.')
      const breadcrumbs = path.map(({ id, name }) => ({ id, name }))
      const token = readCursor(url.searchParams.get('cursor'), `folder:${folder.id}`)
      const page = await drive.listFiles(folder.id, token, true)
      searchSnapshot = undefined
      rememberChildren(path, page.files)
      const body: GalleryPage = {
        folder: { id: folder.id, name: folder.name }, breadcrumbs,
        folders: page.files.filter((file) => file.mimeType === FOLDER_MIME && !file.trashed).map(({ id, name }) => ({ id, name })),
        images: page.files.filter((file) => IMAGE_MIMES.has(file.mimeType) && !file.trashed).map((file) => photo(file, breadcrumbs)),
        nextCursor: page.nextPageToken ? encodeCursor(`folder:${folder.id}`, page.nextPageToken) : null, mode: config.fixture ? 'fixture' : 'live',
      }
      return Response.json(body, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
    } catch (error) {
      const safe = error instanceof GalleryError ? error : new GalleryError(502, 'DRIVE_UNAVAILABLE', 'Không thể kết nối thư viện. Vui lòng thử lại.')
      return Response.json({ error: { code: safe.code, message: safe.message } }, { status: safe.status, headers: { 'Cache-Control': 'no-store', ...(safe.status === 429 ? { 'Retry-After': '60' } : {}) } })
    }
  }
}
