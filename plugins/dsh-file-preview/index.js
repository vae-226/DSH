// dsh-file-preview server half.
//
// Simple HTTP server for file listing, preview, and explorer opening.
// The client discovers the port by trying a range starting from 19876.

import { createServer } from 'node:http'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'
import { execFile } from 'node:child_process'

const name = 'dsh-file-preview'
const PORT_START = 19876
const PORT_END = 19886

const TEXT_EXTS = new Set([
  '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.htm',
  '.xml', '.yaml', '.yml', '.toml', '.csv', '.log', '.py', '.rb', '.go', '.rs',
  '.java', '.c', '.cpp', '.h', '.hpp', '.sh', '.bat', '.ps1', '.sql', '.r',
  '.vue', '.svelte', '.env', '.gitignore', '.npmrc', '.ini', '.cfg', '.conf',
  '.patch', '.diff', '.svg', '.mjs', '.cjs',
])
const MAX_PREVIEW_BYTES = 256 * 1024

function json(res, data) {
  res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
  res.end(JSON.stringify(data))
}

async function listFiles(dir, root) {
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
        result.push({ name: entry.name, path: relPath, type: 'file', size: s.size, previewable: TEXT_EXTS.has(ext) || s.size < 4096, ext, modified: s.mtimeMs })
      } catch {
        result.push({ name: entry.name, path: relPath, type: 'file', size: 0, previewable: false, ext: extname(entry.name) })
      }
    }
  }
  result.sort((a, b) => a.type !== b.type ? (a.type === 'directory' ? -1 : 1) : a.name.localeCompare(b.name))
  return result
}

function apply(ctx) {
  const workspaceDir = process.cwd()
  let server = null

  function startServer(port) {
    if (port > PORT_END) return
    const s = createServer(async (req, res) => {
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST,GET,OPTIONS', 'access-control-allow-headers': 'content-type' }); res.end(); return }
      const url = new URL(req.url, 'http://localhost')
      const path = url.pathname
      let body = ''
      req.on('data', (c) => { body += c })
      req.on('end', async () => {
        let payload = {}
        try { if (body) payload = JSON.parse(body) } catch {}
        if (path === '/list') {
          try { json(res, { ok: true, value: { cwd: workspaceDir, files: await listFiles(workspaceDir, workspaceDir) } }) }
          catch (e) { json(res, { ok: false, error: { code: 'list-failed', message: e.message } }) }
          return
        }
        if (path === '/read') {
          const p = payload.path; if (!p) { json(res, { ok: false, error: { code: 'bad-request', message: 'path required' } }); return }
          const full = join(workspaceDir, p); if (!full.startsWith(workspaceDir)) { json(res, { ok: false, error: { code: 'forbidden' } }); return }
          try {
            const s = await stat(full)
            if (s.size > MAX_PREVIEW_BYTES) { json(res, { ok: true, value: { path: p, size: s.size, truncated: true, content: `File too large (${(s.size/1024).toFixed(1)}KB)` } }); return }
            try { json(res, { ok: true, value: { path: p, size: s.size, content: await readFile(full, 'utf-8') } }) }
            catch { const buf = await readFile(full); json(res, { ok: true, value: { path: p, size: buf.length, content: buf.toString('latin1'), binary: true } }) }
          } catch (e) { json(res, { ok: false, error: { code: 'read-failed', message: e.message } }) }
          return
        }
        if (path === '/open') {
          const p = payload.path; if (!p) { json(res, { ok: false, error: { code: 'bad-request' } }); return }
          const full = join(workspaceDir, p); if (!full.startsWith(workspaceDir)) { json(res, { ok: false, error: { code: 'forbidden' } }); return }
          try { await stat(full); execFile('explorer.exe', ['/select,', full], { windowsHide: true }); json(res, { ok: true, value: { path: p } }) }
          catch (e) { json(res, { ok: false, error: { code: 'open-failed', message: e.message } }) }
          return
        }
        json(res, { ok: false, error: { code: 'unknown-endpoint' } })
      })
    })
    s.on('error', () => { s.close(); startServer(port + 1) })
    s.listen(port, '127.0.0.1', () => {
      server = s
      // Write port to a known location
      import('node:fs').then(fs => {
        fs.writeFileSync(join(workspaceDir, '.dsh-file-preview-port'), String(port))
      }).catch(() => {})
    })
  }

  startServer(PORT_START)
  ctx.effect(() => () => { if (server) server.close() }, 'dsh-file-preview: server')
}

export { name, apply }