import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { createFakeDrive } from './fixtures/drive.ts'

let coldStart = 0
async function loadApi(context: TestContext, env: Record<string, string>, fake = createFakeDrive({ omitParents: true })) {
  const names = ['GOOGLE_DRIVE_API_KEY', 'API_KEY_GOOGLE', 'GOOGLE_DRIVE_ROOT_FOLDER_ID', 'GOOGLE_DRIVE_ROOT_FOLDER_URL', 'GOOGLE_DRIVE_ROOT_RESOURCE_KEY']
  const saved = names.map((name) => [name, process.env[name]] as const)
  context.after(() => {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })
  for (const name of names) delete process.env[name]
  Object.assign(process.env, env)
  context.mock.method(globalThis, 'fetch', fake.fetch)
  const { default: api } = await import(new URL(`../api/gallery.ts?cold-start=${coldStart++}`, import.meta.url).href)
  return api as { fetch(request: Request): Promise<Response> }
}

test('Vercel serves gallery, folder queries and image routes using server environment variables', async (context) => {
  const api = await loadApi(context, {
    API_KEY_GOOGLE: 'vercel-server-only-canary',
    GOOGLE_DRIVE_ROOT_FOLDER_URL: 'https://drive.google.com/drive/folders/root',
  })
  const request = (path: string) => api.fetch(new Request(`https://gallery.vercel.app${path}`)) as Promise<Response>

  const root = await request('/api/gallery')
  assert.equal(root.status, 200)
  const listing = await root.json()
  assert.equal(listing.folder.id, 'root')
  assert.equal(JSON.stringify(listing).includes('vercel-server-only-canary'), false)
  const folder = await request('/api/gallery?folder=quiet')
  assert.equal(folder.status, 200)
  assert.equal((await folder.json()).images[0].id, 'calm')
  const search = await request('/api/gallery?q=Bi%E1%BB%83n')
  assert.equal(search.status, 200)
  assert.equal((await search.json()).images.length, 2)
  for (const action of ['thumbnail', 'preview']) {
    const media = await request(`/api/gallery/images/sunrise/${action}?retry=1`)
    assert.equal(media.status, 200)
    assert.equal(media.headers.get('Content-Type'), 'image/png')
    assert.ok((await media.arrayBuffer()).byteLength > 0)
  }
  const download = await request('/api/gallery/images/sunrise/download')
  assert.equal(download.status, 200)
  assert.equal((await download.json()).url, 'https://drive.google.com/uc?export=download&id=sunrise')
})

test('Vercel accepts the canonical server key and root ID configuration', async (context) => {
  const api = await loadApi(context, { GOOGLE_DRIVE_API_KEY: 'server-only-secret', GOOGLE_DRIVE_ROOT_FOLDER_ID: 'root' })
  assert.equal((await api.fetch(new Request('https://gallery.vercel.app/api/gallery'))).status, 200)
})

test('missing or invalid deployment configuration returns JSON NOT_CONFIGURED rather than a platform 404', async (context) => {
  const configurations: Record<string, string>[] = [
    {},
    { GOOGLE_DRIVE_ROOT_FOLDER_ID: 'root' },
    { GOOGLE_DRIVE_API_KEY: 'server-only-secret', GOOGLE_DRIVE_ROOT_FOLDER_URL: 'https://example.com/not-a-drive-folder' },
  ]
  for (const env of configurations) {
    const api = await loadApi(context, env)
    const response = await api.fetch(new Request('https://gallery.vercel.app/api/gallery'))
    assert.equal(response.status, 503)
    assert.match(response.headers.get('Content-Type') ?? '', /application\/json/)
    assert.equal((await response.json()).error.code, 'NOT_CONFIGURED')
  }
})

test('Vercel distinguishes outside-gallery access, provider failures and Drive rate limits', async (context) => {
  const fake = createFakeDrive()
  const api = await loadApi(context, { GOOGLE_DRIVE_API_KEY: 'server-only-secret', GOOGLE_DRIVE_ROOT_FOLDER_ID: 'root' }, fake)
  const outside = await api.fetch(new Request('https://gallery.vercel.app/api/gallery?folder=outside'))
  assert.equal(outside.status, 404)
  assert.equal((await outside.json()).error.code, 'NOT_FOUND')
  fake.files.push({ id: 'limited', name: 'Hạn mức', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] })
  const limited = await api.fetch(new Request('https://gallery.vercel.app/api/gallery?folder=limited'))
  assert.equal(limited.status, 429)
  assert.equal((await limited.json()).error.code, 'RATE_LIMITED')
  fake.files.push({ id: 'broken', name: 'Lỗi', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] })
  const broken = await api.fetch(new Request('https://gallery.vercel.app/api/gallery?folder=broken'))
  assert.equal(broken.status, 502)
  const failure = await broken.text()
  assert.equal(JSON.parse(failure).error.code, 'DRIVE_UNAVAILABLE')
  assert.equal(failure.includes('provider secret'), false)
  assert.equal(failure.includes('server-only-secret'), false)
})
