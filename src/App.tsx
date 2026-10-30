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
        <a className="wordmark" href="#top" aria-label="Phú Tài và Như Trúc, về đầu trang"><span className="wordmark-icon">&amp;</span><span>Tài <span className="wordmark-period">&amp;</span> Trúc</span></a>
        <nav className="top-links" aria-label="Điều hướng chính"><a href="#gallery">Album ảnh</a><a href="#about">Về ngày cưới</a></nav>
        <div className="top-actions">
          <span className="demo-pill"><i /> {data?.mode === 'fixture' ? 'Ảnh minh hoạ' : 'Album cưới'}</span>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Bật giao diện tối' : 'Bật giao diện sáng'}><span aria-hidden="true">{theme === 'light' ? '◐' : '☼'}</span><span className="theme-label">{theme === 'light' ? 'Tối' : 'Sáng'}</span></button>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-layout">
            <div className="hero-content">
              <span className="eyebrow hero-eyebrow"><span className="eyebrow-line" /> ALBUM CƯỚI · 22.09.2024</span>
              <h1 id="hero-title">Phú Tài<br />&amp; Như <em>Trúc.</em></h1>
              <p>Ngày mình cùng bước sang một chương mới,<br className="desktop-break" /> 22 tháng 9 năm 2024.</p>
              <a className="hero-cta" href="#gallery">Xem album ảnh <span aria-hidden="true">↘</span></a>
            </div>
            <div className="hero-video-card">
              <div className="hero-video-heading"><span><i aria-hidden="true">▶</i> PHIM CƯỚI</span><span>PHÚ TÀI × NHƯ TRÚC <b>·</b> 22.09.2024</span></div>
              <div className="hero-video-frame">
                <iframe
                  src="https://www.youtube.com/embed/G6JsZEJv2V8?si=bIIjXiMP_HGbc54D"
                  title="Video cưới của Phú Tài và Như Trúc"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="gallery-section" id="gallery" aria-labelledby="gallery-title">
          <div className="section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> ALBUM CƯỚI</span><h2 id="gallery-title">Ngày vui còn mãi</h2><p className="section-description">Những khoảnh khắc trong ngày Phú Tài và Như Trúc nên duyên.</p></div><div className="collection-count"><strong>{loading ? '—' : `${images.length.toString().padStart(2, '0')}${data?.nextCursor ? '+' : ''}`}</strong><span>ảnh<br />trong album</span></div></div>

          <div className="gallery-toolbar">
            <div className="folder-tabs" aria-label="Các album cưới">
              <button className={`folder-tab ${!folder && !query ? 'active' : ''}`} onClick={() => openFolder('')}>Toàn bộ album</button>
              {data?.folders.map((item) => <button key={item.id} className="folder-tab" onClick={() => openFolder(item.id)}>{item.name} <span aria-hidden="true">↗</span></button>)}
            </div>
            <label className="search-box"><span className="search-icon" aria-hidden="true">⌕</span><span className="sr-only">Tìm ảnh trong toàn bộ album cưới</span><input type="search" value={query} onChange={(event) => { setSelected(null); setQuery(event.currentTarget.value) }} placeholder="Tìm ảnh trong album cưới…" maxLength={200} /></label>
          </div>

          <div className="gallery-context">
            <nav className="breadcrumbs" aria-label="Vị trí thư mục"><ol>{(data?.breadcrumbs ?? []).map((item, index, all) => <li key={item.id}><button onClick={() => openFolder(item.id)} aria-current={index === all.length - 1 && !query ? 'page' : undefined}>{item.name}</button>{index < all.length - 1 && <span aria-hidden="true">/</span>}</li>)}</ol></nav>
            <button className="refresh-button" onClick={reload} disabled={loading} aria-label="Tải lại album ảnh">Tải lại ↻</button>
          </div>
          <div className="result-line" aria-live="polite"><span>{query.trim() ? `Kết quả trong album cưới: “${query.trim()}”` : data?.folder.name ?? 'Album cưới'}</span><span>{loading ? 'ĐANG TẢI…' : `${images.length} ẢNH${data?.nextCursor ? ' · CÒN TRANG TIẾP' : ''}`}</span></div>

          {loading && <div className="gallery-loading" role="status"><span>Đang tải ảnh…</span><div className="skeleton-grid" aria-hidden="true"><i /><i /><i /></div></div>}
          {!loading && error && <div className="gallery-error" role="alert"><h3>{error.code === 'RATE_LIMITED' ? 'Album cần nghỉ một chút' : error.code === 'NOT_CONFIGURED' ? 'Album đang được chuẩn bị' : 'Chưa thể tải album'}</h3><p>{error.message}</p><button onClick={() => data ? void loadMore() : reload()}>Thử lại</button></div>}
          {!loading && data && images.length > 0 && <div className="photo-grid">{images.map((photo, index) => <GalleryCard key={photo.id} photo={photo} number={index + 1} open={() => setSelected(photo.id)} />)}</div>}
          {!loading && !error && data && images.length === 0 && <div className="empty-state"><span className="empty-mark" aria-hidden="true">⌕</span><h3>{query.trim() ? 'Chưa tìm thấy ảnh phù hợp' : data.folders.length ? 'Chọn một album để bắt đầu' : 'Album này chưa có ảnh'}</h3><p>{query.trim() ? 'Thử tìm bằng một tên ảnh khác nhé.' : data.folders.length ? 'Các album nhỏ đang chờ bạn khám phá.' : 'Những bức ảnh mới sẽ xuất hiện tại đây.'}</p>{query && <button onClick={() => setQuery('')}>Xoá tìm kiếm</button>}</div>}
          {!loading && data?.nextCursor && <div className="load-more"><button disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Đang tải thêm…' : 'Xem thêm ảnh'} <span aria-hidden="true">↓</span></button></div>}
          <div className="gallery-footnote"><span>{data?.mode === 'fixture' ? 'ẢNH MINH HOẠ' : 'ALBUM CƯỚI · 22.09.2024'}</span><span>{data?.mode === 'fixture' ? 'Bạn đang xem ảnh mẫu, không phải album cưới thật.' : 'Mở lại album hoặc tải lại để xem những ảnh mới.'}</span></div>
        </section>

        <section className="about-strip" id="about"><div className="about-mark">&amp;</div><div><span className="eyebrow">VỀ NGÀY CỦA CHÚNG MÌNH</span><p>22 tháng 9 năm 2024 — ngày Phú Tài<br className="desktop-break" /> và Như Trúc bắt đầu hành trình chung.</p></div><span className="about-year">PHÚ TÀI × NHƯ TRÚC · 22.09.2024</span></section>
      </main>
      <footer className="site-footer"><a className="wordmark footer-mark" href="#top" aria-label="Phú Tài và Như Trúc, về đầu trang"><span className="wordmark-icon">&amp;</span><span>Tài <span className="wordmark-period">&amp;</span> Trúc</span></a><span>ALBUM CƯỚI · 22 THÁNG 9, 2024</span><a href="#top">Lên đầu trang ↑</a></footer>
      {currentPhoto && <Lightbox photo={currentPhoto} index={currentIndex} count={images.length} close={closeLightbox} previous={() => setSelected(images[(currentIndex - 1 + images.length) % images.length].id)} next={() => setSelected(images[(currentIndex + 1) % images.length].id)} />}
    </div>
  )
}
