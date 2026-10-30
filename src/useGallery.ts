import { useCallback, useEffect, useRef, useState } from 'react'
import { GalleryApiError, getGalleryJson } from './gallery-api'
import type { GalleryPage } from './gallery-types'

function galleryUrl(folder: string, query: string, cursor?: string) {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  else if (folder) params.set('folder', folder)
  if (cursor) params.set('cursor', cursor)
  return `/api/gallery?${params}`
}

function failure(error: unknown) {
  return error instanceof GalleryApiError ? error : new GalleryApiError('NETWORK_ERROR', 'Không thể kết nối album ảnh. Kiểm tra kết nối mạng và thử lại nhé.')
}

export function useGallery(folder: string, query: string) {
  const [data, setData] = useState<GalleryPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<GalleryApiError | null>(null)
  const [revision, setRevision] = useState(0)
  const generation = useRef(0)
  const moreRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    generation.current++
    const controller = new AbortController()
    moreRequest.current?.abort()
    setLoading(true)
    setLoadingMore(false)
    setError(null)
    setData(null)
    const timer = window.setTimeout(() => {
      void getGalleryJson<GalleryPage>(galleryUrl(folder, query), controller.signal)
        .then((page) => { if (!controller.signal.aborted) setData(page) })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(failure(reason)) })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, query.trim() ? 250 : 0)
    return () => { window.clearTimeout(timer); controller.abort(); moreRequest.current?.abort() }
  }, [folder, query, revision])

  const loadMore = useCallback(async () => {
    if (!data?.nextCursor || loadingMore) return
    const currentGeneration = generation.current
    const controller = new AbortController()
    moreRequest.current = controller
    setLoadingMore(true)
    setError(null)
    try {
      const page = await getGalleryJson<GalleryPage>(galleryUrl(folder, query, data.nextCursor), controller.signal)
      if (controller.signal.aborted || generation.current !== currentGeneration) return
      setData((previous) => previous ? {
        ...page,
        folders: [...new Map([...previous.folders, ...page.folders].map((item) => [item.id, item])).values()],
        images: [...new Map([...previous.images, ...page.images].map((item) => [item.id, item])).values()],
      } : page)
    } catch (reason) {
      if (!controller.signal.aborted && generation.current === currentGeneration) setError(failure(reason))
    } finally {
      if (!controller.signal.aborted && generation.current === currentGeneration) setLoadingMore(false)
    }
  }, [data, folder, query, loadingMore])

  return { data, loading, loadingMore, error, loadMore, reload: () => setRevision((value) => value + 1) }
}
