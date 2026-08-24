// dsh-file-attachment server half.
//
// RPC channel `/dsh-file-attachment`:
//   - upload: receives a base64-encoded file + name, saves to workspace
//   - remove: deletes a file from workspace

import { writeFile, mkdir, unlink } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { existsSync } from 'node:fs'

const CHANNEL = '/dsh-file-attachment'
const name = 'dsh-file-attachment'
const UPLOAD_DIR = '.dsh-uploads'

const ALLOWED_EXTS = new Set([
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml',
  '.py', '.js', '.ts', '.html', '.css', '.java', '.go', '.rs', '.rb',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp3', '.wav', '.mp4', '.mov', '.avi',
])

async function handleRequest(endpoint, payload, ctx) {
  const workspaceDir = ctx?.workspace?.cwd || process.cwd()
  const uploadDir = join(workspaceDir, UPLOAD_DIR)

  if (endpoint === 'upload') {
    if (!payload || typeof payload.name !== 'string' || typeof payload.data !== 'string') {
      return { ok: false, error: { code: 'bad-request', message: 'name and data (base64) required' } }
    }
    const ext = '.' + (payload.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXTS.has(ext)) {
      return { ok: false, error: { code: 'unsupported-type', message: `File type ${ext} not supported` } }
    }
    try {
      await mkdir(uploadDir, { recursive: true })
      const buf = Buffer.from(payload.data, 'base64')
      const dest = join(uploadDir, payload.name)
      await writeFile(dest, buf)
      const relPath = relative(workspaceDir, dest)
      return { ok: true, value: { name: payload.name, path: relPath, size: buf.length } }
    } catch (error) {
      return { ok: false, error: { code: 'upload-failed', message: error.message } }
    }
  }

  if (endpoint === 'remove') {
    if (!payload || typeof payload.path !== 'string') {
      return { ok: false, error: { code: 'bad-request', message: 'path required' } }
    }
    const fullPath = join(workspaceDir, payload.path)
    if (!fullPath.startsWith(workspaceDir)) {
      return { ok: false, error: { code: 'forbidden', message: 'path outside workspace' } }
    }
    try {
      if (existsSync(fullPath)) await unlink(fullPath)
      return { ok: true, value: { path: payload.path } }
    } catch (error) {
      return { ok: false, error: { code: 'remove-failed', message: error.message } }
    }
  }

  return { ok: false, error: { code: 'unknown-endpoint', message: `unknown endpoint: ${endpoint}` } }
}

function apply(ctx) {
  ctx.inject(['connection'], (c) => {
    const handler = (endpoint, payload) => handleRequest(endpoint, payload, c)
    c.effect(() => c.connection.rpc.handle(CHANNEL, handler, { authority: 'loopback' }),
      'dsh-file-attachment: rpc channel')
  })
}

export { name, apply, CHANNEL }