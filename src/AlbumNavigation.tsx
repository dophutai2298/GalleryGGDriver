import { ArrowRightIcon, FolderOpenIcon, ImagesSquareIcon } from '@phosphor-icons/react'
import type { GalleryFolder } from './gallery-types'

export function AlbumTabs({ folders, active, open }: { folders: GalleryFolder[]; active: string | null; open: (id: string) => void }) {
  return (
    <nav className="album-tabs" aria-label="Các album cưới">
      {folders.map((folder) => <button key={folder.id} aria-pressed={folder.id === active} onClick={() => open(folder.id)}>{folder.name}</button>)}
    </nav>
  )
}

export function AlbumFolders({ folders, open }: { folders: GalleryFolder[]; open: (id: string) => void }) {
  return (
    <div className="album-folders">
      {folders.map((folder) => (
        <button className="album-folder" key={folder.id} onClick={() => open(folder.id)} aria-label={`Mở album ${folder.name}`}>
          <FolderOpenIcon size={24} aria-hidden="true" /><span>{folder.name}</span><ArrowRightIcon size={18} aria-hidden="true" />
        </button>
      ))}
      {!folders.length && <div className="empty-state"><ImagesSquareIcon size={36} aria-hidden="true" /><h3>Album đang được chuẩn bị</h3><p>Những khoảnh khắc ngày vui sẽ sớm có mặt tại đây.</p></div>}
    </div>
  )
}
