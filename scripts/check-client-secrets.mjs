import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const secrets = [process.env.GOOGLE_DRIVE_API_KEY, process.env.API_KEY_GOOGLE, 'fixture-key-never-a-real-secret'].filter((value) => value && value.length >= 8)
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await inspect(path)
    else if (/\.(js|css|html|json|map)$/.test(entry.name)) {
      const text = await readFile(path, 'utf8')
      if (secrets.some((secret) => text.includes(secret))) throw new Error(`Server key found in frontend artifact: ${path}`)
    }
  }
}
await inspect('dist')
console.log('Frontend artifacts contain none of the configured server keys.')
