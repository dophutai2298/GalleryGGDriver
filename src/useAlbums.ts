import { useCallback, useEffect, useState } from 'react'
import { GalleryApiError, getGalleryJson } from './gallery-api'
import type { GalleryFolder, GalleryPage } from './gallery-types'

type AlbumIndex = { folders: GalleryFolder[]; mode: GalleryPage['mode'] }

export function useAlbums() {
  const [data, setData] = useState<AlbumIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<GalleryApiError | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    async function readAlbums() {
      const folders = new Map<string, GalleryFolder>()
      const cursors = new Set<string>()
      let cursor: string | null = null
      let page: GalleryPage
      do {
        const path = cursor ? `/api/gallery?cursor=${encodeURIComponent(cursor)}` : '/api/gallery'
        page = await getGalleryJson<GalleryPage>(path, controller.signal)
        for (const folder of page.folders) folders.set(folder.id, folder)
        cursor = page.nextCursor
        if (cursor && cursors.has(cursor)) throw new GalleryApiError('INVALID_CURSOR', 'Chưa thể tải đủ album. Vui lòng thử lại.')
        if (cursor) cursors.add(cursor)
      } while (cursor && !controller.signal.aborted)
      if (!controller.signal.aborted) setData({ folders: [...folders.values()], mode: page.mode })
    }
    const timer = window.setTimeout(() => {
      void readAlbums()
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof GalleryApiError ? reason : new GalleryApiError('NETWORK_ERROR', 'Chưa thể tải danh sách album. Kiểm tra kết nối và thử lại nhé.'))
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 0)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [revision])

  const reload = useCallback(() => setRevision((value) => value + 1), [])
  return { data, loading, error, reload }
}
