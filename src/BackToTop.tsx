import { useEffect, useState } from 'react'
import { ArrowUpIcon } from '@phosphor-icons/react'

export function BackToTop({ hidden }: { hidden: boolean }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const marker = document.getElementById('page-start')
    if (!marker) return
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), { rootMargin: '160px 0px 0px 0px' })
    observer.observe(marker)
    return () => observer.disconnect()
  }, [])
  if (!visible || hidden) return null
  return <button className="back-to-top" aria-label="Lên đầu trang" onClick={() => {
    document.getElementById('top')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }}><ArrowUpIcon size={22} aria-hidden="true" /></button>
}
