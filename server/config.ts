import type { GalleryConfig } from './drive.ts'

export function readGalleryConfig(env: Record<string, string | undefined>): GalleryConfig {
  let rootFolderId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() ?? ''
  let rootResourceKey = env.GOOGLE_DRIVE_ROOT_RESOURCE_KEY?.trim()
  if (!rootFolderId && env.GOOGLE_DRIVE_ROOT_FOLDER_URL) {
    try {
      const url = new URL(env.GOOGLE_DRIVE_ROOT_FOLDER_URL)
      if (url.hostname === 'drive.google.com' && url.protocol === 'https:') {
        rootFolderId = url.pathname.match(/\/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? ''
        rootResourceKey ||= url.searchParams.get('resourcekey') ?? undefined
      }
    } catch { /* Invalid owner configuration yields NOT_CONFIGURED through the API. */ }
  }
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(rootFolderId)) rootFolderId = ''
  return {
    apiKey: env.GOOGLE_DRIVE_API_KEY?.trim() || env.API_KEY_GOOGLE?.trim() || '',
    rootFolderId, rootResourceKey,
  }
}
