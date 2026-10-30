export type GalleryFolder = { id: string; name: string }

export type GalleryPhoto = {
  id: string
  name: string
  mimeType: string
  location: GalleryFolder[]
  modifiedTime?: string
  width?: number
  height?: number
  thumbnailUrl: string
  previewUrl: string
  downloadable: boolean
}

export type GalleryPage = {
  folder: GalleryFolder
  breadcrumbs: GalleryFolder[]
  folders: GalleryFolder[]
  images: GalleryPhoto[]
  nextCursor: string | null
  mode: 'live' | 'fixture'
}

export type GalleryFailure = { error: { code: string; message: string } }
