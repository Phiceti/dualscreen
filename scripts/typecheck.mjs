#!/usr/bin/env node
/**
 * Typecheck every workspace package.
 *
 * Not `tsc -b` with project references: packages resolve each other through
 * their built `.d.ts` files via the workspace symlink, not through source. That
 * keeps each package honest about its own public API — if an export is missing
 * from `index.ts`, this catches it, where a source-path mapping would not.
 *
 * Implication: run `pnpm build` first. CI does.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const PROJECTS = [
  'packages/core',
  'packages/screens',
  'packages/react',
  'packages/devtools',
  'packages/dualscreen',
  'examples/playground',
]

let failed = false

for (const project of PROJECTS) {
  const config = `${project}/tsconfig.json`
  if (!existsSync(config)) {
    console.error(`  ✗ ${project} — no tsconfig.json`)
    failed = true
    continue
  }
  process.stdout.write(`  ${project} … `)
  try {
    execFileSync('npx', ['tsc', '-p', config, '--noEmit'], { stdio: 'pipe' })
    console.log('ok')
  } catch (error) {
    console.log('FAILED')
    process.stdout.write(String(error.stdout ?? '') + String(error.stderr ?? ''))
    failed = true
  }
}

process.exit(failed ? 1 : 0)
