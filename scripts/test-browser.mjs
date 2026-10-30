import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { createServer } from 'vite'

// Owning Vite in this process avoids Windows shell-process-tree teardown issues.
const server = await createServer({ mode: 'fixture', server: { host: '127.0.0.1', port: 5174, strictPort: true } })
const failureServer = await createServer({ mode: 'fixture-failure', server: { host: '127.0.0.1', port: 5175, strictPort: true } })
try {
  await server.listen()
  await failureServer.listen()
  const runner = spawn(process.execPath, [resolve('node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:5174' },
  })
  process.exitCode = await new Promise((accept, reject) => {
    runner.once('error', reject)
    runner.once('exit', (code) => accept(code ?? 1))
  })
} finally { await Promise.all([server.close(), failureServer.close()]) }
