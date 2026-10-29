import { useCallback, useEffect, useState } from 'react'
import { GalleryCard } from './GalleryCard'
import { Lightbox } from './Lightbox'
import { useGallery } from './useGallery'

function initialTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem('frame-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch { /* The gallery remains usable if browser storage is disabled. */ }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const [theme, setTheme] = useState(initialTheme)
  const [folder, setFolder] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const { data, loading, loadingMore, error, loadMore, reload } = useGallery(folder, query)
  const images = data?.images ?? []
  const currentIndex = images.findIndex((photo) => photo.id === selected)
  const currentPhoto = images[currentIndex]
  const closeLightbox = useCallback(() => setSelected(null), [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1b1c19' : '#f6f3ed')
    try { localStorage.setItem('frame-theme', theme) } catch { /* Storage is optional. */ }
  }, [theme])

  function openFolder(id: string) { setSelected(null); setQuery(''); setFolder(id) }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="Frame, về đầu trang"><span className="wordmark-icon">f.</span><span>frame<span className="wordmark-period">.</span></span></a>
        <nav className="top-links" aria-label="Điều hướng chính"><a href="#gallery">Thư viện</a><a href="#about">Về bộ sưu tập</a></nav>
        <div className="top-actions">
          <span className="demo-pill"><i /> {data?.mode === 'fixture' ? 'Ảnh minh hoạ' : 'Thư viện mở'}</span>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Bật giao diện tối' : 'Bật giao diện sáng'}><span aria-hidden="true">{theme === 'light' ? '◐' : '☼'}</span><span className="theme-label">{theme === 'light' ? 'Tối' : 'Sáng'}</span></button>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-photo" /><div className="hero-shade" />
          <div className="hero-content">
            <span className="eyebrow hero-eyebrow"><span className="eyebrow-line" /> MỘT GÓC NHÌN, NHIỀU KỶ NIỆM</span>
            <h1 id="hero-title">Những ngày<br />mình muốn <em>giữ lại.</em></h1>
            <p>Một không gian cho những nơi đã đi qua,<br className="desktop-break" /> những khoảnh khắc muốn nhớ lâu hơn.</p>
            <a className="hero-cta" href="#gallery">Khám phá bộ sưu tập <span aria-hidden="true">↘</span></a>
          </div>
          <div className="hero-caption"><span>Mỗi bức ảnh, một câu chuyện</span><span>Được lưu giữ để cùng nhìn lại</span></div>
        </section>

        <section className="gallery-section" id="gallery" aria-labelledby="gallery-title">
          <div className="section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> THƯ VIỆN HÌNH ẢNH</span><h2 id="gallery-title">Điều còn đọng lại</h2><p className="section-description">Những mảnh ghép nhỏ, được gom về cùng một nơi.</p></div><div className="collection-count"><strong>{loading ? '—' : `${images.length.toString().padStart(2, '0')}${data?.nextCursor ? '+' : ''}`}</strong><span>khoảnh khắc<br />đang hiển thị</span></div></div>

          <div className="gallery-toolbar">
            <div className="folder-tabs" aria-label="Album trong thư mục">
              <button className={`folder-tab ${!folder && !query ? 'active' : ''}`} onClick={() => openFolder('')}>Thư viện gốc</button>
              {data?.folders.map((item) => <button key={item.id} className="folder-tab" onClick={() => openFolder(item.id)}>{item.name} <span aria-hidden="true">↗</span></button>)}
            </div>
            <label className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Tìm theo tên file trong toàn thư viện</span><input type="search" value={query} onChange={(event) => { setSelected(null); setQuery(event.currentTarget.value) }} placeholder="Tìm tên ảnh trong toàn thư viện…" maxLength={200} /></label>
          </div>

          <div className="gallery-context">
            <nav className="breadcrumbs" aria-label="Vị trí thư mục"><ol>{(data?.breadcrumbs ?? []).map((item, index, all) => <li key={item.id}><button onClick={() => openFolder(item.id)} aria-current={index === all.length - 1 && !query ? 'page' : undefined}>{item.name}</button>{index < all.length - 1 && <span aria-hidden="true">/</span>}</li>)}</ol></nav>
            <button className="refresh-button" onClick={reload} disabled={loading} aria-label="Tải lại thư mục">Tải lại ↻</button>
          </div>
          <div className="result-line" aria-live="polite"><span>{query.trim() ? `Tìm toàn thư viện: “${query.trim()}”` : data?.folder.name ?? 'Thư viện'}</span><span>{loading ? 'ĐANG TẢI…' : `${images.length} ẢNH${data?.nextCursor ? ' · CÒN TRANG TIẾP' : ''}`}</span></div>

          {loading && <div className="gallery-loading" role="status"><span>Đang tải ảnh…</span><div className="skeleton-grid" aria-hidden="true"><i /><i /><i /></div></div>}
          {!loading && error && <div className="gallery-error" role="alert"><h3>{error.code === 'RATE_LIMITED' ? 'Thư viện cần nghỉ một chút' : error.code === 'NOT_CONFIGURED' ? 'Thư viện đang được chuẩn bị' : 'Chưa thể tải thư viện'}</h3><p>{error.message}</p><button onClick={() => data ? void loadMore() : reload()}>Thử lại</button></div>}
          {!loading && data && images.length > 0 && <div className="photo-grid">{images.map((photo, index) => <GalleryCard key={photo.id} photo={photo} number={index + 1} open={() => setSelected(photo.id)} />)}</div>}
          {!loading && !error && data && images.length === 0 && <div className="empty-state"><span className="empty-mark" aria-hidden="true">⌕</span><h3>{query.trim() ? 'Chưa tìm thấy ảnh phù hợp' : data.folders.length ? 'Chọn một album để bắt đầu' : 'Folder này chưa có ảnh'}</h3><p>{query.trim() ? 'Thử tìm bằng một tên file khác nhé.' : data.folders.length ? 'Các album phía trên đang chờ bạn khám phá.' : 'Ảnh mới sẽ xuất hiện khi được thêm vào folder công khai.'}</p>{query && <button onClick={() => setQuery('')}>Xoá tìm kiếm</button>}</div>}
          {!loading && data?.nextCursor && <div className="load-more"><button disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Đang tải thêm…' : 'Xem thêm ảnh'} <span aria-hidden="true">↓</span></button></div>}
          <div className="gallery-footnote"><span>{data?.mode === 'fixture' ? 'BỘ ẢNH MINH HOẠ' : 'NỘI DUNG CÔNG KHAI'}</span><span>{data?.mode === 'fixture' ? 'Đang xem dữ liệu mẫu, không phải thư viện Drive thật.' : 'Mở lại folder hoặc tải lại để cập nhật những ảnh mới.'}</span></div>
        </section>

        <section className="about-strip" id="about"><div className="about-mark">f.</div><div><span className="eyebrow">VỀ BỘ SƯU TẬP</span><p>Ảnh được lưu lại để những ngày bình thường<br className="desktop-break" /> cũng có thể tìm thấy một điều đáng nhớ.</p></div><span className="about-year">TỪ NHỮNG KHOẢNH KHẮC ĐỜI THƯỜNG</span></section>
      </main>
      <footer className="site-footer"><a className="wordmark footer-mark" href="#top"><span className="wordmark-icon">f.</span><span>frame<span className="wordmark-period">.</span></span></a><span>MỘT THƯ VIỆN ẢNH · CÔNG KHAI ĐỂ CÙNG XEM</span><a href="#top">Lên đầu trang ↑</a></footer>
      {currentPhoto && <Lightbox photo={currentPhoto} index={currentIndex} count={images.length} close={closeLightbox} previous={() => setSelected(images[(currentIndex - 1 + images.length) % images.length].id)} next={() => setSelected(images[(currentIndex + 1) % images.length].id)} />}
    </div>
  )
}
