// dsh-file-preview server half.
//
// Provides a RPC channel (`/dsh-file-preview`) that the browser-side panel
// calls to list workspace files, read file contents, and open files in
// Windows Explorer.

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, basename, extname } from 'node:path'
import { execFile } from 'node:child_process'

const CHANNEL = '/dsh-file-preview'
const name = 'dsh-file-preview'

// File extensions that can be previewed as text
const TEXT_EXTS = new Set([
  '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.htm',
  '.xml', '.yaml', '.yml', '.toml', '.csv', '.log', '.py', '.rb', '.go', '.rs',
  '.java', '.c', '.cpp', '.h', '.hpp', '.sh', '.bat', '.ps1', '.sql', '.r',
  '.vue', '.svelte', '.env', '.gitignore', '.npmrc', '.editorconfig', '.ini',
  '.cfg', '.conf', '.patch', '.diff', '.svg', '.mjs', '.cjs',
])

const MAX_PREVIEW_BYTES = 256 * 1024 // 256KB max for preview

async function listFiles(dir, root) {
  if (!dir) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const result = []
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue
    if (entry.name === 'node_modules') continue
    const fullPath = join(dir, entry.name)
    const relPath = relative(root, fullPath)
    if (entry.isDirectory()) {
      result.push({ name: entry.name, path: relPath, type: 'directory', children: await listFiles(fullPath, root) })
    } else {
      try {
        const s = await stat(fullPath)
        const ext = extname(entry.name).toLowerCase()
        result.push({
          name: entry.name,
          path: relPath,
          type: 'file',
          size: s.size,
          previewable: TEXT_EXTS.has(ext) || s.size < 4096,
          ext,
          modified: s.mtimeMs,
        })
      } catch {
        result.push({ name: entry.name, path: relPath, type: 'file', size: 0, previewable: false, ext: extname(entry.name) })
      }
    }
  }
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return result
}

async function handleRequest(endpoint, payload, ctx) {
  const workspaceDir = ctx?.workspace?.cwd || process.cwd()
  if (endpoint === 'list') {
    try {
      const files = await listFiles(workspaceDir, workspaceDir)
      return { ok: true, value: { cwd: workspaceDir, files } }
    } catch (error) {
      return { ok: false, error: { code: 'list-failed', message: error.message } }
    }
  }
  if (endpoint === 'read') {
    if (!payload || typeof payload.path !== 'string') {
      return { ok: false, error: { code: 'bad-request', message: 'path required' } }
    }
    const fullPath = join(workspaceDir, payload.path)
    // Safety: don't escape workspace
    const resolved = join(workspaceDir, payload.path)
    if (!resolved.startsWith(workspaceDir)) {
      return { ok: false, error: { code: 'forbidden', message: 'path outside workspace' } }
    }
    try {
      const s = await stat(fullPath)
      if (s.size > MAX_PREVIEW_BYTES) {
        return { ok: true, value: { path: payload.path, size: s.size, truncated: true, content: `File too large for preview (${(s.size / 1024).toFixed(1)}KB > ${MAX_PREVIEW_BYTES / 1024}KB)` } }
      }
      const content = await readFile(fullPath, 'utf-8')
      return { ok: true, value: { path: payload.path, size: s.size, content } }
    } catch (error) {
      // Try latin1 for binary files that might be viewable
      if (error.code === 'ERR_INVALID_ARG_VALUE' || error.message?.includes('encoding')) {
        try {
          const buf = await readFile(fullPath)
          return { ok: true, value: { path: payload.path, size: buf.length, content: buf.toString('latin1'), binary: true } }
        } catch {
          return { ok: false, error: { code: 'read-failed', message: 'Cannot read this file' } }
        }
      }
      return { ok: false, error: { code: 'read-failed', message: error.message } }
    }
  }
  if (endpoint === 'open') {
    if (!payload || typeof payload.path !== 'string') {
      return { ok: false, error: { code: 'bad-request', message: 'path required' } }
    }
    const fullPath = join(workspaceDir, payload.path)
    const resolved = join(workspaceDir, payload.path)
    if (!resolved.startsWith(workspaceDir)) {
      return { ok: false, error: { code: 'forbidden', message: 'path outside workspace' } }
    }
    try {
      await stat(fullPath)
      execFile('explorer.exe', ['/select,', fullPath], { windowsHide: true })
      return { ok: true, value: { path: payload.path } }
    } catch (error) {
      return { ok: false, error: { code: 'open-failed', message: error.message } }
    }
  }
  return { ok: false, error: { code: 'unknown-endpoint', message: `unknown endpoint: ${endpoint}` } }
}

function apply(ctx) {
  ctx.inject(['connection', 'workspace'], (c) => {
    const handler = (endpoint, payload) => handleRequest(endpoint, payload, c)
    c.effect(() => c.connection.rpc.handle(CHANNEL, handler, { authority: 'loopback' }),
      'dsh-file-preview: rpc channel')
  })
}

export { name, apply, CHANNEL }