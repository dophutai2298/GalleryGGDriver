import { useEffect, useMemo, useState } from 'react'

type Photo = {
  id: number
  name: string
  folder: string
  date: string
  note: string
  tile: number
  shape: 'portrait' | 'landscape' | 'square'
}

const photos: Photo[] = [
  { id: 1, name: 'Sớm ở làng chài.jpg', folder: 'Biển & đảo', date: '12 tháng 6, 2025', note: 'Một buổi sáng chậm rãi ở miền Trung', tile: 0, shape: 'portrait' },
  { id: 2, name: 'Nắng trên mái ngói.jpg', folder: 'Góc phố', date: '08 tháng 6, 2025', note: 'Hà Nội, sau cơn mưa đầu hạ', tile: 1, shape: 'landscape' },
  { id: 3, name: 'Qua ô cửa nhỏ.png', folder: 'Những ngày thường', date: '02 tháng 6, 2025', note: 'Ánh sáng ghé qua căn phòng', tile: 2, shape: 'square' },
  { id: 4, name: 'Màu xanh tháng sáu.webp', folder: 'Biển & đảo', date: '29 tháng 5, 2025', note: 'Con đường dẫn ra phía biển', tile: 3, shape: 'landscape' },
  { id: 5, name: 'Chiều bên hiên nhà.jpg', folder: 'Những ngày thường', date: '21 tháng 5, 2025', note: 'Chút yên bình cuối ngày', tile: 4, shape: 'portrait' },
  { id: 6, name: 'Mùa hoa qua phố.jpg', folder: 'Góc phố', date: '16 tháng 5, 2025', note: 'Một góc phố vừa thức giấc', tile: 5, shape: 'square' },
]

const folders = ['Tất cả ảnh', 'Biển & đảo', 'Góc phố', 'Những ngày thường']
const sprite = '/images/gallery-sprite.png'

function PhotoImage({ photo, className = '' }: { photo: Photo; className?: string }) {
  const col = photo.tile % 3
  const row = Math.floor(photo.tile / 3)
  return (
    <div
      className={`photo-image tile-${photo.tile} ${className}`}
      role="img"
      aria-label={photo.name}
      style={{ backgroundImage: `url(${sprite})`, backgroundPosition: `${col * 50}% ${row * 100}%` }}
    />
  )
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('frame-theme')
    return stored === 'dark' || stored === 'light' ? stored : 'light'
  })
  const [folder, setFolder] = useState('Tất cả ảnh')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)

  const visiblePhotos = useMemo(() => photos.filter((photo) => {
    const matchesFolder = folder === 'Tất cả ảnh' || photo.folder === folder
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')
    const matchesQuery = !normalizedQuery || `${photo.name} ${photo.folder}`.toLocaleLowerCase('vi').includes(normalizedQuery)
    return matchesFolder && matchesQuery
  }), [folder, query])

  const currentIndex = visiblePhotos.findIndex((photo) => photo.id === selected)
  const currentPhoto = currentIndex >= 0 ? visiblePhotos[currentIndex] : null

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('frame-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!currentPhoto) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
      if (event.key === 'ArrowRight') setSelected(visiblePhotos[(currentIndex + 1) % visiblePhotos.length]?.id ?? null)
      if (event.key === 'ArrowLeft') setSelected(visiblePhotos[(currentIndex - 1 + visiblePhotos.length) % visiblePhotos.length]?.id ?? null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPhoto, currentIndex, visiblePhotos])

  const downloadPhoto = async (photo: Photo) => {
    const image = new Image()
    image.src = sprite
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth / 3
    canvas.height = image.naturalHeight / 2
    const col = photo.tile % 3
    const row = Math.floor(photo.tile / 3)
    canvas.getContext('2d')?.drawImage(image, col * canvas.width, row * canvas.height, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
    const anchor = document.createElement('a')
    anchor.href = canvas.toDataURL('image/png')
    anchor.download = photo.name.replace(/\.[^.]+$/, '.png')
    anchor.click()
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Frame, về đầu trang"><span className="wordmark-icon">f.</span><span>frame<span className="wordmark-period">.</span></span></a>
        <nav className="top-links" aria-label="Điều hướng chính"><a href="#gallery">Thư viện</a><a href="#about">Về bộ sưu tập</a></nav>
        <div className="top-actions">
          <span className="demo-pill"><i /> Bản xem trước</span>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Bật giao diện tối' : 'Bật giao diện sáng'} title={theme === 'light' ? 'Bật giao diện tối' : 'Bật giao diện sáng'}>
            <span aria-hidden="true">{theme === 'light' ? '◐' : '☼'}</span><span className="theme-label">{theme === 'light' ? 'Tối' : 'Sáng'}</span>
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-photo" />
          <div className="hero-shade" />
          <div className="hero-content">
            <span className="eyebrow hero-eyebrow"><span className="eyebrow-line" /> MỘT GÓC NHÌN, NHIỀU KỶ NIỆM</span>
            <h1 id="hero-title">Những ngày<br />mình muốn <em>giữ lại.</em></h1>
            <p>Một bộ sưu tập nhỏ về những nơi đã đi qua,<br className="desktop-break" /> những khoảnh khắc muốn nhớ lâu hơn.</p>
            <a className="hero-cta" href="#gallery">Khám phá bộ sưu tập <span aria-hidden="true">↘</span></a>
          </div>
          <div className="hero-caption"><span>16°03' N, 108°13' E</span><span>Đà Nẵng, Việt Nam · 2025</span></div>
          <div className="hero-index">01 <span>/</span> 06</div>
        </section>

        <section className="gallery-section" id="gallery">
          <div className="section-heading">
            <div><span className="eyebrow"><span className="eyebrow-line" /> THƯ VIỆN HÌNH ẢNH</span><h2>Điều còn đọng lại</h2><p className="section-description">Những mảnh ghép nhỏ, được gom về cùng một nơi.</p></div>
            <div className="collection-count"><strong>06</strong><span>khoảnh khắc<br />được lưu giữ</span></div>
          </div>

          <div className="gallery-toolbar">
            <div className="folder-tabs" role="tablist" aria-label="Lọc theo thư mục">
              {folders.map((item) => <button key={item} role="tab" aria-selected={folder === item} className={folder === item ? 'folder-tab active' : 'folder-tab'} onClick={() => setFolder(item)}>{item}{item === 'Tất cả ảnh' && <span className="tab-count">06</span>}</button>)}
            </div>
            <label className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Tìm theo tên ảnh hoặc thư mục</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Tìm một khoảnh khắc..." /><kbd>⌕</kbd></label>
          </div>

          <div className="result-line"><span>{query ? `Kết quả cho “${query}”` : folder}</span><span>{visiblePhotos.length.toString().padStart(2, '0')} ẢNH</span></div>
          {visiblePhotos.length ? <div className="photo-grid">
            {visiblePhotos.map((photo, index) => <button key={photo.id} className={`photo-card ${photo.shape}`} onClick={() => setSelected(photo.id)} aria-label={`Mở ảnh ${photo.name}`}>
              <div className="photo-frame"><PhotoImage photo={photo} /><span className="photo-open" aria-hidden="true">↗</span><span className="photo-number">{String(index + 1).padStart(2, '0')}</span></div>
              <div className="photo-meta"><div><h3>{photo.name}</h3><span>{photo.folder}</span></div><time>{photo.date}</time></div>
            </button>)}
          </div> : <div className="empty-state"><span className="empty-mark">⌕</span><h3>Chưa tìm thấy ảnh phù hợp</h3><p>Thử một tên file hoặc thư mục khác nhé.</p><button onClick={() => { setQuery(''); setFolder('Tất cả ảnh') }}>Xem tất cả ảnh</button></div>}
          <div className="gallery-footnote"><span>ĐANG XEM BẢN MINH HOẠ</span><span>Ảnh thật sẽ được đồng bộ từ Google Drive khi cấu hình folder công khai.</span></div>
        </section>

        <section className="about-strip" id="about"><div className="about-mark">f.</div><div><span className="eyebrow">VỀ BỘ SƯU TẬP</span><p>Ảnh được lưu lại để những ngày bình thường<br className="desktop-break" /> cũng có thể tìm thấy một điều đáng nhớ.</p></div><span className="about-year">TỪ NHỮNG CHUYẾN ĐI · 2025</span></section>
      </main>

      <footer className="site-footer"><a className="wordmark footer-mark" href="#top"><span className="wordmark-icon">f.</span><span>frame<span className="wordmark-period">.</span></span></a><span>MỘT THƯ VIỆN ẢNH RIÊNG TƯ · CÔNG KHAI ĐỂ CÙNG XEM</span><a href="#top">Lên đầu trang ↑</a></footer>

      {currentPhoto && <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Ảnh ${currentPhoto.name}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
        <button className="lightbox-close" onClick={() => setSelected(null)} aria-label="Đóng ảnh">×</button>
        <button className="lightbox-arrow previous" onClick={() => setSelected(visiblePhotos[(currentIndex - 1 + visiblePhotos.length) % visiblePhotos.length].id)} aria-label="Ảnh trước">←</button>
        <div className="lightbox-content"><PhotoImage photo={currentPhoto} className="lightbox-image" /><div className="lightbox-caption"><div><span>{currentPhoto.folder} · {currentPhoto.date}</span><h2>{currentPhoto.name}</h2><p>{currentPhoto.note}</p></div><button className="download-button" onClick={() => void downloadPhoto(currentPhoto)}>Tải ảnh minh hoạ <span aria-hidden="true">↓</span></button></div></div>
        <button className="lightbox-arrow next" onClick={() => setSelected(visiblePhotos[(currentIndex + 1) % visiblePhotos.length].id)} aria-label="Ảnh tiếp theo">→</button>
        <div className="lightbox-count">{String(currentIndex + 1).padStart(2, '0')} <span>/</span> {String(visiblePhotos.length).padStart(2, '0')}</div>
      </div>}
    </div>
  )
}
