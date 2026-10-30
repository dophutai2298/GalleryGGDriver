export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span className="brand-monogram" /></span>
}

export function Brand() {
  return <a className="brand" href="#top" aria-label="Phú Tài và Như Trúc, về đầu trang"><BrandMark /><span className="brand-ampersand">Save the day </span></a>
}
