import { useState } from 'react'
import type { GalleryPhoto } from './gallery-types'

export function GalleryCard({ photo, number, open }: { photo: GalleryPhoto; number: number; open: () => void }) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const shape = photo.width && photo.height ? (photo.height > photo.width ? 'portrait' : photo.width > photo.height * 1.2 ? 'landscape' : 'square') : 'square'
  return (
    <article className={`photo-card ${shape}`}>
      <div className="photo-frame">
        <button className="photo-select" onClick={open} aria-label={`Mở ảnh ${photo.name}`}>
          {!failed && <img className="gallery-image" src={`${photo.thumbnailUrl}?retry=${attempt}`} alt={photo.name} loading="lazy" decoding="async" onError={() => setFailed(true)} />}
          {failed && <span className="image-fallback">Không tải được ảnh</span>}
          <span className="photo-open" aria-hidden="true">↗</span>
          <span className="photo-number">{String(number).padStart(2, '0')}</span>
        </button>
        {failed && <button className="image-retry" onClick={() => { setFailed(false); setAttempt((value) => value + 1) }} aria-label={`Tải lại ảnh ${photo.name}`}>Thử lại ↻</button>}
      </div>
      <div className="photo-meta"><div><h3>{photo.name}</h3><span>{photo.location.map((folder) => folder.name).join(' / ')}</span></div>{photo.modifiedTime && <time dateTime={photo.modifiedTime}>{new Date(photo.modifiedTime).toLocaleDateString('vi-VN')}</time>}</div>
    </article>
  )
}
