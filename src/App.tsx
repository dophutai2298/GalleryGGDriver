import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  ArrowUpRightIcon,
  ArrowClockwiseIcon,
  CaretRightIcon,
  ImagesSquareIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  SunIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AlbumFolders, AlbumTabs } from "./AlbumNavigation";
import { BackToTop } from "./BackToTop";
import { Brand, BrandMark } from "./Brand";
import { GalleryCard } from "./GalleryCard";
import { Lightbox } from "./Lightbox";
import { useAlbums } from "./useAlbums";
import { useGallery } from "./useGallery";

function initialTheme(): "light" | "dark" {
  try {
    const stored = localStorage.getItem("frame-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* Storage is optional. */
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type AlbumView = { folder: string | null | undefined; parents: string[] };

function showGallery() {
  document
    .getElementById("gallery")
    ?.scrollIntoView({ block: "start", behavior: "instant" });
}

export default function App() {
  const [theme, setTheme] = useState(initialTheme);
  // Undefined selects the first child after loading; null explicitly opens the album overview.
  const [view, setView] = useState<AlbumView>({
    folder: undefined,
    parents: [],
  });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const albums = useAlbums();
  const folders = albums.data?.folders ?? [];
  const folder =
    view.folder === undefined ? (folders[0]?.id ?? null) : view.folder;
  const searching = !!query.trim();
  const gallery = useGallery(folder ?? "", query, !!folder || searching);
  const { data, loadingMore, loadMore } = gallery;
  const loading = albums.loading || gallery.loading;
  const error = albums.error ?? gallery.error;
  const images = data?.images ?? [];
  const currentIndex = images.findIndex((photo) => photo.id === selected);
  const currentPhoto = images[currentIndex];
  const activeAlbum = view.parents[0] ?? folder;
  const breadcrumbs = data?.breadcrumbs.slice(1) ?? [];
  const overview = !folder && !searching;
  const closeLightbox = useCallback(() => setSelected(null), []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#1b1c19" : "#f6f3ed");
    try {
      localStorage.setItem("frame-theme", theme);
    } catch {
      /* Storage is optional. */
    }
  }, [theme]);

  function openAlbum(id: string) {
    setSelected(null);
    setQuery("");
    setView({ folder: id, parents: [] });
    showGallery();
  }

  function openChild(id: string) {
    setSelected(null);
    setQuery("");
    setView({ folder: id, parents: folder ? [...view.parents, folder] : [] });
    showGallery();
  }

  function goBack() {
    setSelected(null);
    showGallery();
    document.getElementById("gallery-title")?.focus({ preventScroll: true });
    if (searching) {
      setQuery("");
      return;
    }
    const parents = [...view.parents];
    setView({ folder: parents.pop() ?? null, parents });
  }

  function reload() {
    if (albums.error || overview) albums.reload();
    else gallery.reload();
  }

  return (
    <div className="app-shell">
      <div id="page-start" aria-hidden="true" />
      <a className="skip-link" href="#gallery">
        Đến album ảnh
      </a>
      <header className="topbar">
        <Brand />
        {/* <nav className="top-links" aria-label="Điều hướng chính">
          <a href="#gallery">Album ảnh</a>
          <a href="#about">Về ngày cưới</a>
        </nav> */}
        <div className="top-actions">
          {(folder || searching) && (
            <button
              className="nav-back"
              onClick={goBack}
              aria-label={
                searching
                  ? "Quay lại album"
                  : view.parents.length
                    ? "Quay lại album trước"
                    : "Quay lại danh sách album"
              }
            >
              <ArrowLeftIcon size={20} aria-hidden="true" />
              <span>Quay lại</span>
            </button>
          )}
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            aria-label={
              theme === "light" ? "Bật giao diện tối" : "Bật giao diện sáng"
            }
          >
            {theme === "light" ? (
              <MoonIcon size={20} aria-hidden="true" />
            ) : (
              <SunIcon size={20} aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      <main id="top" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-layout">
            <div className="hero-content">
              <time className="wedding-date" dateTime="2024-09-22">
                22.09.2024
              </time>
              <h1 id="hero-title">
                Phú Tài
                <br />
                <span>
                  &amp; Như <em>Trúc</em>
                </span>
              </h1>
              <p>
                Một ngày để nhớ,
                <br />
                Một đời để thương.
              </p>
              <a className="hero-cta" href="#gallery">
                Xem album ảnh <ArrowUpRightIcon size={20} aria-hidden="true" />
              </a>
            </div>
            <div className="hero-video-card">
              <div className="hero-video-heading">
                <span>Phim ngày cưới</span>
                <time dateTime="2024-09-22">22.09.2024</time>
              </div>
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

        <section
          className="gallery-section"
          id="gallery"
          aria-labelledby="gallery-title"
        >
          <div className="section-heading">
            <h2 id="gallery-title" tabIndex={-1}>
              Ngày vui còn mãi
            </h2>
            <p>Những khoảnh khắc trong ngày Phú Tài và Như Trúc nên duyên.</p>
          </div>
          {!!folders.length && (
            <AlbumTabs
              folders={folders}
              active={overview || searching ? null : activeAlbum}
              open={openAlbum}
            />
          )}
          <div className="gallery-toolbar">
            <label className="search-box">
              <MagnifyingGlassIcon size={21} aria-hidden="true" />
              <span className="sr-only">Tìm ảnh trong toàn bộ album cưới</span>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setSelected(null);
                  setQuery(event.currentTarget.value);
                }}
                placeholder="Tìm theo tên ảnh…"
                maxLength={200}
              />
            </label>
            <button
              className="refresh-button"
              onClick={reload}
              disabled={loading}
              aria-label={
                overview ? "Tải lại danh sách album" : "Tải lại album ảnh"
              }
            >
              <ArrowClockwiseIcon size={20} aria-hidden="true" />
              <span>Tải lại</span>
            </button>
          </div>
          {!overview && !searching && breadcrumbs.length > 1 && (
            <nav className="breadcrumbs" aria-label="Vị trí album">
              <ol>
                {breadcrumbs.map((item, index) => (
                  <li key={item.id}>
                    {index > 0 && (
                      <CaretRightIcon size={14} aria-hidden="true" />
                    )}
                    <button
                      aria-current={
                        index === breadcrumbs.length - 1 ? "page" : undefined
                      }
                      onClick={() => {
                        setSelected(null);
                        setQuery("");
                        setView({
                          folder: item.id,
                          parents: breadcrumbs
                            .slice(0, index)
                            .map((parent) => parent.id),
                        });
                        showGallery();
                      }}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="result-line" aria-live="polite">
            <span>
              {searching
                ? `Kết quả cho “${query.trim()}”`
                : overview
                  ? "Chọn album bạn muốn xem"
                  : (data?.folder.name ?? "Album cưới")}
            </span>
            <span>
              {loading
                ? "Đang tải…"
                : overview
                  ? `${folders.length} album`
                  : `${images.length}${data?.nextCursor ? "+" : ""} ảnh`}
            </span>
          </div>

          {loading && (
            <div className="gallery-loading" role="status">
              <span>Đang tải ảnh…</span>
              <div className="skeleton-grid" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
          {!loading && error && (
            <div className="gallery-error" role="alert">
              <h3>
                {error.code === "RATE_LIMITED"
                  ? "Album cần nghỉ một chút"
                  : error.code === "NOT_CONFIGURED"
                    ? "Album đang được chuẩn bị"
                    : "Chưa thể tải album"}
              </h3>
              <p>{error.message}</p>
              <button
                onClick={() =>
                  gallery.error && data ? void loadMore() : reload()
                }
              >
                Thử lại <ArrowClockwiseIcon size={18} aria-hidden="true" />
              </button>
            </div>
          )}
          {!loading && !error && overview && (
            <AlbumFolders folders={folders} open={openAlbum} />
          )}
          {!loading && !overview && !searching && !!data?.folders.length && (
            <div className="nested-albums">
              <h3>Album trong {data.folder.name}</h3>
              <AlbumFolders folders={data.folders} open={openChild} />
            </div>
          )}
          {!loading && !overview && images.length > 0 && (
            <div className="photo-grid">
              {images.map((photo, index) => (
                <GalleryCard
                  key={photo.id}
                  photo={photo}
                  number={index + 1}
                  open={() => setSelected(photo.id)}
                />
              ))}
            </div>
          )}
          {!loading && !error && !overview && data && images.length === 0 && (
            <div className="empty-state">
              <ImagesSquareIcon size={36} aria-hidden="true" />
              <h3>
                {searching
                  ? "Chưa tìm thấy ảnh phù hợp"
                  : data.folders.length
                    ? "Chọn một album nhỏ để xem"
                    : "Album này chưa có ảnh"}
              </h3>
              <p>
                {searching
                  ? "Thử tìm bằng một tên ảnh khác nhé."
                  : data.folders.length
                    ? "Những khoảnh khắc đang nằm trong các album phía trên."
                    : "Những bức ảnh mới sẽ xuất hiện tại đây."}
              </p>
              {searching && (
                <button onClick={() => setQuery("")}>
                  Xoá tìm kiếm <XIcon size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {!loading && data?.nextCursor && (
            <div className="load-more">
              <button disabled={loadingMore} onClick={() => void loadMore()}>
                {loadingMore ? "Đang tải thêm…" : "Xem thêm ảnh"}{" "}
                <ArrowDownIcon size={20} aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="gallery-footnote">
            <span>
              {albums.data?.mode === "fixture"
                ? "Bạn đang xem ảnh minh hoạ."
                : "Lưu giữ ngày vui, cùng nhau nhìn lại."}
            </span>
            <span>Phú Tài &amp; Như Trúc · 22.09.2024</span>
          </div>
        </section>

        {/* <section className="about-strip" id="about"><BrandMark /><div><h2>Về ngày của chúng mình</h2><p>22 tháng 9 năm 2024, Phú Tài và Như Trúc bắt đầu hành trình chung.</p></div></section> */}
      </main>
      <footer className="site-footer">
        <Brand />
        <span>Album cưới · 22.09.2024</span>
        <a href="#top" aria-label="Về đầu trang">
          Lên đầu <ArrowUpIcon size={18} aria-hidden="true" />
        </a>
      </footer>
      <BackToTop hidden={!!currentPhoto} />
      {currentPhoto && (
        <Lightbox
          photo={currentPhoto}
          index={currentIndex}
          count={images.length}
          close={closeLightbox}
          previous={() =>
            setSelected(
              images[(currentIndex - 1 + images.length) % images.length].id,
            )
          }
          next={() =>
            setSelected(images[(currentIndex + 1) % images.length].id)
          }
        />
      )}
    </div>
  );
}
