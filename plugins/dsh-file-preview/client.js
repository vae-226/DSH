// dsh-file-preview browser half (v1.0.0).
//
// A floating 📂 file sidebar for DSH Web:
//   - Browse workspace files in a tree panel
//   - Click to preview in a full-screen overlay
//   - Open in Windows Explorer
//
// Server-side RPC channel: /dsh-file-preview
// Endpoints: list, read, open

window.__ModuleLoader__.load({
  id: 'dsh-file-preview',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const CHANNEL = '/dsh-file-preview'

    const CSS =
      '.dfp-btn{position:fixed;right:16px;bottom:176px;z-index:9997;display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;border:1px solid rgba(127,127,127,.4);background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#111);font-size:12px;line-height:18px;font-family:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18);user-select:none;opacity:.92;transition:opacity .15s ease}' +
      '.dfp-btn:hover{opacity:1}' +
      '.dfp-panel{position:fixed;right:16px;bottom:210px;z-index:9996;width:280px;max-height:420px;box-sizing:border-box;padding:8px 0;border-radius:12px;border:1px solid rgba(127,127,127,.35);background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#111);box-shadow:0 8px 28px rgba(0,0,0,.22);overflow-y:auto;display:flex;flex-direction:column}' +
      '.dfp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 12px 6px;font-weight:600;font-size:13px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08))}' +
      '.dfp-close{flex:none;border:none;background:none;color:var(--dsw-alias-label-tertiary,#888);cursor:pointer;font-size:14px;line-height:14px;padding:2px 4px;border-radius:6px}' +
      '.dfp-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}' +
      '.dfp-tree{flex:1;overflow-y:auto;padding:4px 0}' +
      '.dfp-item{display:flex;align-items:center;gap:6px;padding:3px 12px;cursor:pointer;font-size:12px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary,#111)}' +
      '.dfp-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}' +
      '.dfp-item.dir{font-weight:500}' +
      '.dfp-item .ico{flex:none;font-size:13px;width:18px;text-align:center}' +
      '.dfp-actions{display:flex;gap:4px;padding:4px 12px;border-top:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08))}' +
      '.dfp-action{flex:1;padding:4px 6px;border:none;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-secondary,#555);cursor:pointer;font-size:11px;line-height:16px;font-family:inherit}' +
      '.dfp-action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.08))}' +
      '.dfp-overlay{position:fixed;top:0;right:0;bottom:0;left:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}' +
      '.dfp-overlay-box{width:min(90vw,900px);max-height:90vh;background:var(--dsw-alias-bg-layer-2,#fff);border-radius:14px;box-shadow:0 12px 48px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}' +
      '.dfp-overlay-head{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));font-size:13px;font-weight:600}' +
      '.dfp-overlay-body{flex:1;overflow:auto;padding:16px;font-family:var(--ds-font-family-code,monospace);font-size:13px;line-height:22px;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary,#111)}' +
      '.dfp-loading{color:var(--dsw-alias-label-tertiary,#888);padding:16px;text-align:center;font-size:12px}'

    // ── state ─────────────────────────────────────────────────────────────
    let rootEl = null; let btnEl = null; let panelEl = null; let treeEl = null
    let open = false; let files = []; let cwd = ''
    let rpcCall = null

    function iconFor(entry) {
      if (entry.type === 'directory') return '📁'
      const ext = entry.ext || ''
      if (['.md','.txt','.log'].includes(ext)) return '📝'
      if (['.js','.ts','.jsx','.tsx','.mjs','.cjs'].includes(ext)) return '🟨'
      if (['.json','.yaml','.yml','.toml'].includes(ext)) return '📋'
      if (['.html','.css','.svg'].includes(ext)) return '🌐'
      if (['.py','.rb','.go','.rs','.java','.c','.cpp'].includes(ext)) return '⚙️'
      if (['.pdf'].includes(ext)) return '📕'
      if (['.docx','.doc'].includes(ext)) return '📄'
      if (['.png','.jpg','.jpeg','.gif','.webp'].includes(ext)) return '🖼️'
      return '📄'
    }

    function renderTree(items, indent = 0) {
      let html = ''
      for (const item of items) {
        html += `<div class="dfp-item ${item.type === 'directory' ? 'dir' : ''}" style="padding-left:${12 + indent * 16}px" data-path="${item.path}" data-type="${item.type}">
          <span class="ico">${iconFor(item)}</span><span>${item.name}</span></div>`
        if (item.children && item.children.length > 0) {
          html += renderTree(item.children, indent + 1)
        }
      }
      return html
    }

    async function loadFiles() {
      if (!rpcCall) return
      try {
        const res = await rpcCall('list')
        if (res && res.ok) {
          cwd = res.value.cwd || ''
          files = res.value.files || []
          if (treeEl) treeEl.innerHTML = renderTree(files)
        }
      } catch {}
    }

    async function previewFile(path) {
      if (!rpcCall) return
      try {
        const res = await rpcCall('read', { path })
        if (!res || !res.ok) return
        const { content, size, truncated } = res.value
        const overlay = document.createElement('div')
        overlay.className = 'dfp-overlay'
        overlay.innerHTML = `<div class="dfp-overlay-box">
          <div class="dfp-overlay-head">
            <span>📄 ${path.split(/[\\/]/).pop()}</span>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="font-size:11px;color:var(--dsw-alias-label-tertiary,#888)">${(size / 1024).toFixed(1)}KB</span>
              <button class="dfp-close" id="dfp-overlay-close" title="关闭">×</button>
            </div>
          </div>
          <div class="dfp-overlay-body">${truncated ? content : (content || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
        </div>`
        document.body.appendChild(overlay)
        overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove() } })
        overlay.querySelector('#dfp-overlay-close').addEventListener('click', () => overlay.remove())
      } catch {}
    }

    async function openInExplorer(path) {
      if (!rpcCall) return
      try { await rpcCall('open', { path }) } catch {}
    }

    function setupRPC(ctx) {
      // Try connection service
      if (ctx && ctx.connection && ctx.connection.rpc && typeof ctx.connection.rpc.call === 'function') {
        rpcCall = (endpoint, payload) => ctx.connection.rpc.call(CHANNEL, endpoint, payload)
        return true
      }
      // Try remote service
      if (ctx && ctx.remote && typeof ctx.remote.$call === 'function') {
        rpcCall = (endpoint, payload) => ctx.remote.$call(CHANNEL, endpoint, payload)
        return true
      }
      return false
    }

    function setup() {
      if (typeof document === 'undefined' || rootEl) return

      rootEl = document.createElement('div')
      rootEl.className = 'dfp-root'

      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-file-preview'
      style.dataset.pluginCss = 'dsh-file-preview/styles'
      style.textContent = CSS
      document.head.appendChild(style)
      rootEl.__style = style

      btnEl = document.createElement('button')
      btnEl.type = 'button'
      btnEl.className = 'dfp-btn'
      btnEl.textContent = '📂 文件'
      btnEl.title = '工作区文件'
      btnEl.addEventListener('click', () => {
        open = !open
        if (panelEl) panelEl.hidden = !open
        if (open) loadFiles()
      })

      panelEl = document.createElement('div')
      panelEl.className = 'dfp-panel'
      panelEl.hidden = true

      const head = document.createElement('div')
      head.className = 'dfp-head'
      const title = document.createElement('span')
      title.textContent = '📂 工作区文件'
      const close = document.createElement('button')
      close.type = 'button'
      close.className = 'dfp-close'
      close.textContent = '×'
      close.title = '关闭'
      close.addEventListener('click', () => { open = false; panelEl.hidden = true })
      head.appendChild(title)
      head.appendChild(close)

      treeEl = document.createElement('div')
      treeEl.className = 'dfp-tree'
      treeEl.innerHTML = '<div class="dfp-loading">加载中…</div>'
      treeEl.addEventListener('click', (e) => {
        const item = e.target.closest('.dfp-item')
        if (!item) return
        const path = item.dataset.path
        const type = item.dataset.type
        if (type === 'file') previewFile(path)
      })

      const actions = document.createElement('div')
      actions.className = 'dfp-actions'
      const openBtn = document.createElement('button')
      openBtn.className = 'dfp-action'
      openBtn.textContent = '📂 在资源管理器打开'
      openBtn.addEventListener('click', () => openInExplorer(cwd))
      actions.appendChild(openBtn)

      panelEl.appendChild(head)
      panelEl.appendChild(treeEl)
      panelEl.appendChild(actions)
      rootEl.appendChild(panelEl)
      rootEl.appendChild(btnEl)
      document.body.appendChild(rootEl)

      if (!rpcCall) {
        btnEl.style.opacity = '0.5'
        btnEl.title = '文件预览：RPC 通道未连接'
      }
    }

    function dispose() {
      if (rootEl) {
        if (rootEl.__style) rootEl.__style.remove()
        rootEl.remove()
      }
      rootEl = null; btnEl = null; panelEl = null; treeEl = null
    }

    function apply(ctx) {
      setupRPC(ctx)
      if (ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => { setup(); return dispose }, 'dsh-file-preview: panel')
      } else {
        setup()
      }
    }

    exports.apply = apply
    exports.inject = ['connection']
    return module.exports
  },
})