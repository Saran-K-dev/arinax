import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const tempDirectory = path.resolve('node_modules', '.vitest-temp')
mkdirSync(tempDirectory, { recursive: true })

const result = spawnSync(
  process.execPath,
  [path.resolve('node_modules', 'vitest', 'vitest.mjs'), ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      TEMP: tempDirectory,
      TMP: tempDirectory,
      TMPDIR: tempDirectory,
    },
  },
)

process.exitCode = result.status ?? 1
