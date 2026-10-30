export const FOLDER_MIME = 'application/vnd.google-apps.folder'
export const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type DriveFile = {
  id: string
  name: string
  mimeType: string
  parents?: string[]
  trashed?: boolean
  resourceKey?: string
  thumbnailLink?: string
  webContentLink?: string
  modifiedTime?: string
  imageMediaMetadata?: { width?: number; height?: number }
  capabilities?: { canDownload?: boolean }
}

export type DrivePage = { files: DriveFile[]; nextPageToken?: string; incompleteSearch?: boolean }
export type GalleryConfig = {
  apiKey: string
  rootFolderId: string
  rootResourceKey?: string
  fetch?: typeof fetch
  fixture?: boolean
}

export class GalleryError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const fields = 'id,name,mimeType,parents,trashed,resourceKey,thumbnailLink,webContentLink,modifiedTime,imageMediaMetadata(width,height),capabilities(canDownload)'

export function createDriveClient(config: GalleryConfig) {
  const transport = config.fetch ?? fetch
  const resourceKeys = new Map<string, string>()
  const responses = new Map<string, { promise: Promise<unknown>; expires: number }>()
  if (config.rootResourceKey) resourceKeys.set(config.rootFolderId, config.rootResourceKey)

  function remember(file: DriveFile) {
    if (file.resourceKey) resourceKeys.set(file.id, file.resourceKey)
    while (resourceKeys.size > 10_000) {
      const oldest = [...resourceKeys.keys()].find((id) => id !== config.rootFolderId)
      if (!oldest) break
      resourceKeys.delete(oldest)
    }
    return file
  }

  async function cached<T>(key: string, fresh: boolean, read: () => Promise<T>): Promise<T> {
    const existing = responses.get(key)
    if (!fresh && existing && existing.expires > Date.now()) return existing.promise as Promise<T>
    const promise = read()
    responses.set(key, { promise, expires: Date.now() + 30_000 })
    while (responses.size > 64) responses.delete(responses.keys().next().value!)
    try { return await promise } catch (error) {
      if (responses.get(key)?.promise === promise) responses.delete(key)
      throw error
    }
  }

  async function request<T>(path: string, params: Record<string, string>, id: string): Promise<T> {
    const url = new URL(`https://www.googleapis.com/drive/v3/files${path}`)
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value)
    url.searchParams.set('key', config.apiKey)
    const headers = new Headers()
    // Only keys belonging to files in this gallery are collected, never supplied by visitors.
    const referenced = [...new Set([config.rootFolderId, id])].filter((item) => resourceKeys.has(item))
    if (referenced.length) headers.set('X-Goog-Drive-Resource-Keys', referenced.map((item) => `${item}/${resourceKeys.get(item)}`).join(','))
    const response = await transport(url, { headers, redirect: 'error', signal: AbortSignal.timeout(15_000) })
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: { errors?: { reason?: string }[] } }
      const limited = response.status === 429 || body.error?.errors?.some((item) => /rateLimit|dailyLimit|quota/i.test(item.reason ?? ''))
      if (limited) throw new GalleryError(429, 'RATE_LIMITED', 'Thư viện đang có nhiều lượt xem. Vui lòng thử lại sau ít phút.')
      if (response.status === 404) throw new GalleryError(404, 'NOT_FOUND', 'Không tìm thấy nội dung hoặc nội dung chưa được chia sẻ công khai.')
      throw new GalleryError(502, 'DRIVE_UNAVAILABLE', 'Chưa thể đọc Google Drive. Vui lòng thử lại sau.')
    }
    return response.json() as Promise<T>
  }

  return {
    async getFile(id: string, fresh = false) {
      return remember(await cached(`file:${id}`, fresh, () => request<DriveFile>(`/${encodeURIComponent(id)}`, { fields, supportsAllDrives: 'true' }, id)))
    },
    async listFiles(id: string, pageToken?: string, fresh = false): Promise<DrivePage> {
      const params: Record<string, string> = {
        q: `'${id}' in parents and trashed = false and (${[FOLDER_MIME, ...IMAGE_MIMES].map((mime) => `mimeType = '${mime}'`).join(' or ')})`,
        fields: `nextPageToken,incompleteSearch,files(${fields})`,
        pageSize: '1000',
        orderBy: 'folder,name_natural',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      }
      if (pageToken) params.pageToken = pageToken
      const page = await cached(`list:${id}:${pageToken ?? ''}`, fresh, () => request<DrivePage>('', params, id))
      page.files = (page.files ?? []).map(remember)
      if (page.incompleteSearch) throw new GalleryError(503, 'INCOMPLETE_SEARCH', 'Google Drive chưa trả về đầy đủ nội dung. Vui lòng thử lại.')
      return page
    },
  }
}
