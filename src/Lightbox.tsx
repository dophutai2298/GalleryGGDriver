import { useEffect, useRef, useState } from 'react'
import { ArrowLeftIcon, ArrowRightIcon, DownloadSimpleIcon, XIcon } from '@phosphor-icons/react'
import { formatAlbumLocation } from './album-location'
import { GalleryApiError, getGalleryJson } from './gallery-api'
import type { GalleryPhoto } from './gallery-types'

export function Lightbox({ photo, index, count, close, previous, next }: {
  photo: GalleryPhoto; index: number; count: number; close: () => void; previous: () => void; next: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const downloadRequest = useRef<AbortController | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [downloadError, setDownloadError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    element.showModal()
    document.body.style.overflow = 'hidden'
    return () => { element.close(); document.body.style.overflow = previousOverflow; opener?.focus() }
  }, [])

  useEffect(() => {
    setAttempt(0)
    setImageState('loading')
    setDownloadError('')
    setDownloading(false)
    return () => downloadRequest.current?.abort()
  }, [photo.id])

  async function download() {
    if (downloading) return
    const controller = new AbortController()
    downloadRequest.current?.abort()
    downloadRequest.current = controller
    setDownloading(true)
    setDownloadError('')
    try {
      const result = await getGalleryJson<{ url: string }>(`/api/gallery/images/${encodeURIComponent(photo.id)}/download`, controller.signal)
      if (controller.signal.aborted) return
      const anchor = document.createElement('a')
      anchor.href = result.url
      anchor.download = photo.name
      anchor.rel = 'noopener noreferrer'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    } catch (reason) {
      if (!controller.signal.aborted) setDownloadError(reason instanceof GalleryApiError ? reason.message : 'Chưa thể tải ảnh gốc. Vui lòng thử lại.')
    } finally { if (!controller.signal.aborted) setDownloading(false) }
  }

  return (
    <dialog ref={dialog} className="lightbox" aria-labelledby="lightbox-title" onCancel={(event) => { event.preventDefault(); close() }} onClick={(event) => { if (event.target === event.currentTarget) close() }} onKeyDown={(event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); previous() }
      if (event.key === 'ArrowRight') { event.preventDefault(); next() }
    }}>
      <button className="lightbox-close" onClick={close} aria-label="Đóng ảnh"><XIcon size={24} aria-hidden="true" /></button>
      <button className="lightbox-arrow previous" onClick={previous} aria-label="Ảnh trước" disabled={count < 2}><ArrowLeftIcon size={22} aria-hidden="true" /></button>
      <div className="lightbox-content">
        <div className="lightbox-image-stage">
          {imageState !== 'failed' && <img key={`${photo.id}-${attempt}`} className="lightbox-photo" src={`${photo.previewUrl}?retry=${attempt}`} alt={photo.name} onLoad={() => setImageState('ready')} onError={() => setImageState('failed')} />}
          {imageState === 'loading' && <p className="image-message" role="status">Đang tải ảnh…</p>}
          {imageState === 'failed' && <div className="image-message" role="status"><p>Ảnh xem trước chưa khả dụng.</p><button className="download-button" onClick={() => { setAttempt((value) => value + 1); setImageState('loading') }}>Thử tải lại ảnh</button></div>}
        </div>
        <div className="lightbox-caption"><div><span>{formatAlbumLocation(photo.location)}</span><h2 id="lightbox-title">{photo.name}</h2>{downloadError && <p className="download-error" role="alert">{downloadError}</p>}</div><button className="download-button" aria-disabled={downloading} aria-busy={downloading} onClick={() => void download()}>{downloading ? 'Đang chuẩn bị…' : 'Tải ảnh gốc'} <DownloadSimpleIcon size={20} aria-hidden="true" /></button></div>
      </div>
      <button className="lightbox-arrow next" onClick={next} aria-label="Ảnh tiếp theo" disabled={count < 2}><ArrowRightIcon size={22} aria-hidden="true" /></button>
      <div className="lightbox-count" aria-live="polite">{String(index + 1).padStart(2, '0')} <span>/</span> {String(count).padStart(2, '0')}</div>
    </dialog>
  )
}
