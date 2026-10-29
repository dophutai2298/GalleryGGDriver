import type { GalleryFailure } from './gallery-types'

export class GalleryApiError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

export async function getGalleryJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: 'no-store' })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as GalleryFailure | null
    throw new GalleryApiError(body?.error?.code ?? 'UNAVAILABLE', body?.error?.message ?? 'Không thể tải thư viện. Vui lòng thử lại.')
  }
  return response.json() as Promise<T>
}
