#!/usr/bin/env node
/**
 * Validate HTML nesting in every docs page.
 *
 * VitePress compiles rendered markdown as a Vue template, so malformed nesting
 * is a hard build failure — but the error it reports points at a line in the
 * generated SFC, not at your markdown, which makes it genuinely painful to
 * track down.
 *
 * The failure mode is specific and easy to reintroduce: markdown-it wraps a
 * trailing inline element in a `<p>` and swallows the block's closing tag with
 * it, producing `<a>…<p>…</a></p>`. This catches that before the build does,
 * and names the file.
 *
 * Run from the repo root.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DOCS = 'docs'

/** Elements that never have a closing tag, HTML and SVG alike. */
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
  'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'ellipse', 'use', 'stop',
])

function markdownFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === 'public') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...markdownFiles(full))
    else if (entry.endsWith('.md')) out.push(full)
  }
  return out
}

/** Report every nesting mismatch in a rendered HTML string. */
function checkNesting(html) {
  const problems = []
  const stack = []
  const lines = html.split('\n')

  lines.forEach((line, index) => {
    for (const match of line.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
      const [, closing, rawName, selfClosing] = match
      const name = rawName.toLowerCase()
      if (VOID.has(name) || selfClosing) continue

      if (closing) {
        const top = stack[stack.length - 1]
        if (top?.name === name) stack.pop()
        else problems.push(`line ${index + 1}: </${name}> closes ${top ? `<${top.name}> opened on line ${top.line}` : 'nothing'}`)
      } else {
        stack.push({ name, line: index + 1 })
      }
    }
  })

  for (const open of stack) problems.push(`line ${open.line}: <${open.name}> is never closed`)
  return problems
}

const { createMarkdownRenderer } = await import(
  pathToFileURL(join(process.cwd(), DOCS, 'node_modules/vitepress/dist/node/index.js')).href
)
const md = await createMarkdownRenderer(join(process.cwd(), DOCS))

let failed = false
for (const file of markdownFiles(DOCS)) {
  const source = readFileSync(file, 'utf8').replace(/^---[\s\S]*?\n---\n/, '')
  const problems = checkNesting(md.render(source))
  if (problems.length === 0) {
    console.log(`  ${file} … ok`)
  } else {
    failed = true
    console.log(`  ${file} … ${problems.length} problem(s)`)
    for (const problem of problems.slice(0, 8)) console.log(`      ${problem}`)
  }
}

if (failed) {
  console.error('\nHTML nesting problems will fail the VitePress build with an unhelpful message. Fix them above.')
  process.exit(1)
}
