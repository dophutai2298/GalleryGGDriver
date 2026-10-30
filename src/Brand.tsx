import { FlowerLotusIcon } from '@phosphor-icons/react'

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><FlowerLotusIcon size={28} weight="duotone" /></span>
}

export function Brand() {
  return <a className="brand" href="#top" aria-label="Phú Tài và Như Trúc, về đầu trang"><BrandMark /><span>Tài <span className="brand-ampersand">&amp;</span> Trúc</span></a>
}
