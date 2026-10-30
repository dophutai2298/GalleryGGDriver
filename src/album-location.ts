import type { GalleryFolder } from './gallery-types'

export function formatAlbumLocation(location: GalleryFolder[]) {
  return location.slice(1).map((folder) => folder.name).join(' / ') || 'Album cưới'
}
