// dsh-file-preview browser half (v1.2.0).
//
// Codex-style left sidebar: file tree, full-screen preview, open in explorer.
// Server runs on ports 19876-19886; client auto-discovers.

window.__ModuleLoader__.load({
  id: 'dsh-file-preview',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const CSS =
      '.dfp-sidebar{position:fixed;left:0;top:0;bottom:0;z-index:800;width:0;overflow:hidden;background:var(--dsw-alias-bg-layer-2,#fff);border-right:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));transition:width .2s ease;display:flex;flex-direction:column}' +
      '.dfp-sidebar.open{width:260px}' +
      '.dfp-sidebar-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));font-size:13px;font-weight:600;flex:none}' +
      '.dfp-sidebar-tree{flex:1;overflow-y:auto;padding:4px 0}' +
      '.dfp-sidebar-foot{flex:none;padding:6px 12px;border-top:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08))}' +
      '.dfp-sidebar-btn{width:100%;padding:4px 8px;border:none;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04));color:var(--dsw-alias-label-secondary,#555);cursor:pointer;font-size:11px;line-height:18px;font-family:inherit}' +
      '.dfp-sidebar-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.08))}' +
      '.dfp-toggle{position:fixed;left:0;top:50%;z-index:801;transform:translateY(-50%);width:24px;height:56px;border:none;border-radius:0 8px 8px 0;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-secondary,#777);cursor:pointer;font-size:14px;text-align:center;box-shadow:2px 0 12px rgba(0,0,0,.12);opacity:.9;transition:left .2s ease;padding:0;display:flex;align-items:center;justify-content:center}' +
      '.dfp-toggle:hover{opacity:1}' +
      '.dfp-sidebar.open~.dfp-toggle{left:260px}' +
      '.dfp-item{display:flex;align-items:center;gap:6px;padding:3px 12px;cursor:pointer;font-size:12px;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-primary,#111)}' +
      '.dfp-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.04))}' +
      '.dfp-item.dir{font-weight:500}' +
      '.dfp-item .ico{flex:none;font-size:13px;width:18px;text-align:center}' +
      '.dfp-overlay{position:fixed;top:0;right:0;bottom:0;left:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}' +
      '.dfp-overlay-box{width:min(90vw,900px);max-height:90vh;background:var(--dsw-alias-bg-layer-2,#fff);border-radius:14px;box-shadow:0 12px 48px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}' +
      '.dfp-overlay-head{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));font-size:13px;font-weight:600}' +
      '.dfp-overlay-body{flex:1;overflow:auto;padding:16px;font-family:var(--ds-font-family-code,monospace);font-size:13px;line-height:22px;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary,#111)}' +
      '.dfp-loading{color:var(--dsw-alias-label-tertiary,#888);padding:16px;text-align:center;font-size:12px}' +
      '.dfp-upload-input{display:none}'

    let sidebarEl, toggleEl, treeEl, open = false, files = [], cwd = '', baseUrl = ''

    async function discoverPort() {
      for (let port = 19876; port <= 19886; port++) {
        try {
          const res = await fetch(`http://127.0.0.1:${port}/list`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
          if (res.ok) { baseUrl = `http://127.0.0.1:${port}`; return true }
        } catch {}
      }
      return false
    }

    async function rpc(endpoint, payload) {
      if (!baseUrl) { if (!await discoverPort()) throw new Error('no server') }
      const res = await fetch(`${baseUrl}/${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload || {}) })
      return (await res.json())
    }

    function iconFor(entry) {
      if (entry.type === 'directory') return '📁'
      const ext = entry.ext || ''
      if (['.md','.txt','.log'].includes(ext)) return '📝'
      if (['.js','.ts','.jsx','.tsx','.mjs','.cjs'].includes(ext)) return '🟨'
      if (['.json','.yaml','.yml','.toml'].includes(ext)) return '📋'
      if (['.html','.css','.svg'].includes(ext)) return '🌐'
      if (['.py','.rb','.go','.rs','.java','.c','.cpp'].includes(ext)) return '⚙️'
      return '📄'
    }

    function renderTree(items, indent = 0) {
      let html = ''
      for (const item of items) {
        html += `<div class="dfp-item ${item.type === 'directory' ? 'dir' : ''}" style="padding-left:${12 + indent * 16}px" data-path="${item.path}" data-type="${item.type}"><span class="ico">${iconFor(item)}</span><span>${item.name}</span></div>`
        if (item.children && item.children.length > 0) html += renderTree(item.children, indent + 1)
      }
      return html
    }

    async function loadFiles() {
      treeEl.innerHTML = '<div class="dfp-loading">加载中…</div>'
      try {
        const res = await rpc('list')
        if (res && res.ok) { cwd = res.value.cwd || ''; files = res.value.files || []; treeEl.innerHTML = renderTree(files) }
        else treeEl.innerHTML = '<div class="dfp-loading">加载失败</div>'
      } catch { treeEl.innerHTML = '<div class="dfp-loading">连接失败</div>' }
    }

    async function previewFile(path) {
      try {
        const res = await rpc('read', { path })
        if (!res || !res.ok) return
        const { content, size, truncated } = res.value
        const overlay = document.createElement('div')
        overlay.className = 'dfp-overlay'
        overlay.innerHTML = `<div class="dfp-overlay-box"><div class="dfp-overlay-head"><span>📄 ${path.split(/[\\/]/).pop()}</span><div style="display:flex;gap:6px;align-items:center"><span style="font-size:11px;color:var(--dsw-alias-label-tertiary,#888)">${(size/1024).toFixed(1)}KB</span><button class="dfp-sidebar-btn" id="dfp-ov-close" style="width:auto;padding:2px 8px">×</button></div></div><div class="dfp-overlay-body">${truncated ? content : (content||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`
        document.body.appendChild(overlay)
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove() })
        overlay.querySelector('#dfp-ov-close').addEventListener('click', () => overlay.remove())
      } catch {}
    }

    async function openInExplorer(entryPath) {
      try { await rpc('open', { path: typeof entryPath === 'string' ? entryPath : '.' }) } catch {}
    }

    async function uploadFileRpc(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1]
          try {
            const res = await fetch(`${baseUrl}/upload`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: file.name, data: base64 }) })
            resolve(await res.json())
          } catch (e) { reject(e) }
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }

    function setup() {
      if (typeof document === 'undefined' || sidebarEl) return
      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-file-preview'
      style.dataset.pluginCss = 'dsh-file-preview/styles'
      style.textContent = CSS
      document.head.appendChild(style)

      sidebarEl = document.createElement('div')
      sidebarEl.className = 'dfp-sidebar'
      sidebarEl.innerHTML = `<div class="dfp-sidebar-head"><span>📂 文件</span><button class="dfp-sidebar-btn" id="dfp-sidebar-close" style="width:auto;padding:2px 8px">×</button></div><div class="dfp-sidebar-tree"></div><div class="dfp-sidebar-foot"><button class="dfp-sidebar-btn" id="dfp-upload-btn">📎 上传文件</button><button class="dfp-sidebar-btn" id="dfp-explorer-btn" style="margin-top:4px">📂 在资源管理器打开</button></div><input type="file" class="dfp-upload-input" id="dfp-upload-input" multiple accept=".zip,.tar,.gz,.bz2,.7z,.rar,.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.csv,.json,.xml,.yaml,.yml,.py,.js,.ts,.java,.go,.rs,.rb,.html,.css,.mp3,.wav,.mp4,.mov,.avi,.png,.jpg,.jpeg,.gif,.webp,.svg">`
      document.body.appendChild(sidebarEl)

      treeEl = sidebarEl.querySelector('.dfp-sidebar-tree')
      treeEl.addEventListener('click', (e) => {
        const item = e.target.closest('.dfp-item')
        if (!item) return
        if (item.dataset.type === 'file') previewFile(item.dataset.path)
      })
      sidebarEl.querySelector('#dfp-sidebar-close').addEventListener('click', () => { open = false; sidebarEl.classList.remove('open') })
      sidebarEl.querySelector('#dfp-explorer-btn').addEventListener('click', () => openInExplorer(cwd))
      sidebarEl.querySelector('#dfp-upload-btn').addEventListener('click', () => sidebarEl.querySelector('#dfp-upload-input').click())
      sidebarEl.querySelector('#dfp-upload-input').addEventListener('change', async (e) => {
        for (const file of e.target.files || []) {
          try { const res = await uploadFileRpc(file); if (res && res.ok) loadFiles() } catch {}
        }
      })

      toggleEl = document.createElement('button')
      toggleEl.type = 'button'
      toggleEl.className = 'dfp-toggle'
      toggleEl.textContent = '▸'
      toggleEl.title = '文件侧边栏'
      toggleEl.addEventListener('click', () => {
        open = !open
        sidebarEl.classList.toggle('open', open)
        toggleEl.textContent = open ? '◂' : '▸'
        if (open) loadFiles()
      })
      document.body.appendChild(toggleEl)
    }

    function dispose() {
      if (sidebarEl) sidebarEl.remove()
      if (toggleEl) toggleEl.remove()
      sidebarEl = null; toggleEl = null; treeEl = null
    }

    function apply(ctx) {
      if (ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => { setup(); return dispose }, 'dsh-file-preview: sidebar')
      } else { setup() }
    }

    exports.apply = apply
    exports.inject = []
    return module.exports
  },
})