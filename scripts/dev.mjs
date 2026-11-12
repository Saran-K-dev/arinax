import { spawn } from 'node:child_process'
import net from 'node:net'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const children = new Set()
let shuttingDown = false

function stopAll(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 250).unref()
}

function start(label, args, { env = {} } = {}) {
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })
  children.add(child)
  child.on('error', (error) => {
    console.error(`${label} failed to start:`, error.message)
    stopAll(1)
  })
  child.on('exit', (code, signal) => {
    children.delete(child)
    if (!shuttingDown) {
      console.error(`${label} stopped (${signal || (code ?? 'unknown')}); stopping the other development process.`)
      stopAll(code || 1)
    }
  })
  return child
}

function portAvailable(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, host, () => server.close(() => resolve(true)))
  })
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

const envPort = readFileSync(path.join(root, '.env'), 'utf8').match(/^PORT\s*=\s*(\d+)\s*$/m)?.[1]
const apiPort = Number(process.env.ARENA_X_API_PORT || envPort || 43127)
if (await portAvailable(apiPort, '0.0.0.0')) start('ARENA X API', ['server/index.mjs'], { env: { PORT: String(apiPort) } })
else console.warn(`API port ${apiPort} is already in use; using its existing listener.`)

let vitePort = 54173
while (vitePort < 54200 && !(await portAvailable(vitePort, '127.0.0.1'))) vitePort += 1
if (vitePort >= 54200) throw new Error('Could not find an available local Vite port (54173–54199).')
console.log(`ARENA X website: http://127.0.0.1:${vitePort}/`)
start('Vite', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'])
