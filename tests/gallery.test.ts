import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGalleryHandler } from '../server/gallery.ts'
import { createFakeDrive } from './fixtures/drive.ts'

test('public root listing returns supported photos and folders without exposing the Drive key', async () => {
  const fake = createFakeDrive()
  const handler = createGalleryHandler({ rootFolderId: 'root', apiKey: 'server-only-secret', fetch: fake.fetch })
  const response = await handler(new Request('http://gallery.test/api/gallery'))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.folder.name, 'Bộ sưu tập')
  assert.deepEqual(body.images.map((image: { name: string }) => image.name), ['Bình minh.jpg', 'Ảnh thiếu thumbnail.png'])
  assert.ok(body.folders.some((folder: { name: string }) => folder.name === 'Biển & đảo'))
  assert.equal(JSON.stringify(body).includes('server-only-secret'), false)
  assert.equal(JSON.stringify(body).includes('googleusercontent.com'), false)
})

test('nested folders return breadcrumbs while outside folders cannot be browsed', async () => {
  const fake = createFakeDrive()
  const handler = createGalleryHandler({ rootFolderId: 'root', apiKey: 'secret', fetch: fake.fetch })
  const nested = await handler(new Request('http://gallery.test/api/gallery?folder=quiet'))
  assert.equal(nested.status, 200)
  const body = await nested.json()
  assert.deepEqual(body.breadcrumbs.map((folder: { name: string }) => folder.name), ['Bộ sưu tập', 'Biển & đảo', 'Ngày yên'])
  assert.equal(body.images[0].name, 'Biển lặng.png')
  assert.equal((await handler(new Request('http://gallery.test/api/gallery?folder=outside'))).status, 404)
  assert.equal((await handler(new Request("http://gallery.test/api/gallery?folder=bad%27id"))).status, 400)
})

test('listing and global filename search cross the 1000-file boundary and refresh changed contents', async () => {
  const fake = createFakeDrive()
  fake.files.push(...Array.from({ length: 1001 }, (_, index) => ({ id: `extra-${index}`, name: `Ảnh_${index}.jpg`, mimeType: 'image/jpeg', parents: ['root'] })))
  const handler = createGalleryHandler({ rootFolderId: 'root', apiKey: 'secret', fetch: fake.fetch })
  const first = await (await handler(new Request('http://gallery.test/api/gallery'))).json()
  const second = await (await handler(new Request(`http://gallery.test/api/gallery?cursor=${encodeURIComponent(first.nextCursor)}`))).json()
  assert.equal(first.images.length + second.images.length, 1003)
  assert.ok(second.images.some((image: { id: string }) => image.id === 'extra-1000'))
  const search = await (await handler(new Request('http://gallery.test/api/gallery?q=biển'))).json()
  assert.deepEqual(search.images.map((image: { name: string }) => image.name), ['Biển chiều.webp', 'Biển lặng.png'])
  assert.deepEqual(search.images[1].location.map((folder: { id: string }) => folder.id), ['root', 'sea', 'quiet'])
  const laterPage = await (await handler(new Request('http://gallery.test/api/gallery?q=Ảnh_1000'))).json()
  assert.equal(laterPage.images[0].id, 'extra-1000')
  fake.files.push({ id: 'new', name: 'Mới thêm.png', mimeType: 'image/png', parents: ['root'] })
  const refreshed = await (await handler(new Request(`http://gallery.test/api/gallery?cursor=${encodeURIComponent(first.nextCursor)}`))).json()
  assert.ok(refreshed.images.some((image: { id: string }) => image.id === 'new'))
})

test('thumbnail and original download routes enforce the gallery boundary and recover after a missing thumbnail is fixed', async () => {
  const fake = createFakeDrive()
  const handler = createGalleryHandler({ rootFolderId: 'root', apiKey: 'secret', fetch: fake.fetch })
  const image = await handler(new Request('http://gallery.test/api/gallery/images/sunrise/thumbnail'))
  assert.equal(image.status, 200)
  assert.equal(image.headers.get('Content-Type'), 'image/png')
  assert.ok((await image.arrayBuffer()).byteLength > 0)
  const download = await (await handler(new Request('http://gallery.test/api/gallery/images/sunrise/download'))).json()
  assert.equal(download.url, 'https://drive.google.com/uc?export=download&id=sunrise')
  for (const action of ['thumbnail', 'preview', 'download']) {
    assert.equal((await handler(new Request(`http://gallery.test/api/gallery/images/outside-image/${action}`))).status, 404)
  }
  const missing = await handler(new Request('http://gallery.test/api/gallery/images/missing/thumbnail'))
  assert.equal((await missing.json()).error.code, 'THUMBNAIL_UNAVAILABLE')
  fake.files.find((file) => file.id === 'missing')!.thumbnailLink = 'https://lh3.googleusercontent.com/fixture/recovered=s220'
  assert.equal((await handler(new Request('http://gallery.test/api/gallery/images/missing/thumbnail?retry=1'))).status, 200)
  assert.equal((await handler(new Request('http://gallery.test/api/gallery/images/missing/download'))).status, 404)
})

test('provider errors, quota exhaustion, and invalid media targets return safe distinct failures', async () => {
  const fake = createFakeDrive()
  fake.files.push(
    { id: 'broken', name: 'Lỗi', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
    { id: 'limited', name: 'Hạn mức', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] },
  )
  const handler = createGalleryHandler({ rootFolderId: 'root', apiKey: 'server-only-secret', fetch: fake.fetch })
  const broken = await handler(new Request('http://gallery.test/api/gallery?folder=broken'))
  assert.equal(broken.status, 502)
  assert.equal((await broken.text()).includes('provider secret'), false)
  const limited = await handler(new Request('http://gallery.test/api/gallery?folder=limited'))
  assert.equal(limited.status, 429)
  assert.equal((await limited.json()).error.code, 'RATE_LIMITED')
  fake.files.find((file) => file.id === 'sunrise')!.thumbnailLink = 'http://127.0.0.1/private'
  assert.equal((await handler(new Request('http://gallery.test/api/gallery/images/sunrise/thumbnail?retry=1'))).status, 404)
  fake.files.find((file) => file.id === 'sunrise')!.webContentLink = 'https://evil.example/download'
  assert.equal((await handler(new Request('http://gallery.test/api/gallery/images/sunrise/download?retry=1'))).status, 404)
})

test('public Drive responses may omit parents: membership is proven by walking down from the configured root', async () => {
  const fake = createFakeDrive({ omitParents: true })
  const handler = createGalleryHandler({ rootFolderId: 'root', apiKey: 'secret', fetch: fake.fetch })
  const folder = await handler(new Request('http://gallery.test/api/gallery?folder=quiet'))
  assert.equal(folder.status, 200)
  assert.deepEqual((await folder.json()).breadcrumbs.map((item: { id: string }) => item.id), ['root', 'sea', 'quiet'])
  assert.equal((await handler(new Request('http://gallery.test/api/gallery/images/calm/preview'))).status, 200)
  fake.files.find((file) => file.id === 'calm')!.parents = ['outside']
  assert.equal((await handler(new Request('http://gallery.test/api/gallery/images/calm/preview?retry=1'))).status, 404)
})
