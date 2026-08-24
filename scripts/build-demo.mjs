#!/usr/bin/env node
/**
 * Build the demo playground and stage it inside the docs site.
 *
 * This exists as a script rather than an npm one-liner for two reasons.
 *
 * The first is a bug this replaces: writing `DEMO_BASE=/demo/ vite build`
 * inline *shadows* a DEMO_BASE exported by the caller, so CI's deploy path
 * (`/<repo>/demo/`) was silently overridden by the local default and the
 * deployed demo requested its bundle from the wrong prefix. Reading the
 * variable with a fallback — rather than assigning it — keeps the local
 * default while letting the deploy win.
 *
 * The second is portability: the copy step used `rm -rf`/`mkdir -p`/`cp -r`,
 * which never ran on Windows.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// The caller wins; `/demo/` is only the default for a local site build.
const base = process.env.DEMO_BASE || '/demo/'
if (!base.startsWith('/') || !base.endsWith('/')) {
  console.error(`[build-demo] DEMO_BASE must start and end with "/" (got ${JSON.stringify(base)}).`)
  process.exit(1)
}

console.log(`[build-demo] base = ${base}`)

const build = spawnSync('pnpm', ['--filter', 'dualscreen-playground', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DEMO_BASE: base },
})
if (build.status !== 0) process.exit(build.status ?? 1)

const from = join(root, 'examples/playground/dist')
const to = join(root, 'docs/public/demo')
if (!existsSync(from)) {
  console.error(`[build-demo] expected build output at ${from}`)
  process.exit(1)
}

rmSync(to, { recursive: true, force: true })
mkdirSync(dirname(to), { recursive: true })
cpSync(from, to, { recursive: true })
console.log(`[build-demo] staged -> docs/public/demo`)
