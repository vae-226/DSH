// dsh-file-attachment browser half (v1.0.0).
//
// Adds file upload support to DSH Web chat:
//   - Extends the chat file input to accept zip/pdf/docx and more formats
//   - Uploads files to the workspace via RPC channel /dsh-file-attachment
//   - Uploaded files appear in the file-preview sidebar

window.__ModuleLoader__.load({
  id: 'dsh-file-attachment',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const CHANNEL = '/dsh-file-attachment'
    // Extended accept types for file input
    const EXTENDED_ACCEPT = '.zip,.tar,.gz,.bz2,.7z,.rar,.pdf,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.md,.csv,.json,.xml,.yaml,.yml,.py,.js,.ts,.java,.go,.rs,.rb,.html,.css,.mp3,.wav,.mp4,.mov,.avi,.png,.jpg,.jpeg,.gif,.webp,.svg'

    async function rpc(endpoint, payload) {
      const url = `${location.origin}${CHANNEL}/${endpoint}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: endpoint, payload: payload || {} })
      })
      const data = await res.json()
      return data.result
    }

    function uploadFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = reader.result.split(',')[1]
          rpc('upload', { name: file.name, data: base64 }).then(resolve).catch(reject)
        }
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.readAsDataURL(file)
      })
    }

    function patchFileInputs() {
      // Find all file inputs in the document and extend their accept attribute
      const inputs = document.querySelectorAll('input[type="file"]')
      for (const input of inputs) {
        const current = input.getAttribute('accept') || ''
        if (current.includes('image/') && !current.includes('.zip')) {
          input.setAttribute('accept', EXTENDED_ACCEPT)
        }
      }
    }

    function setup() {
      if (typeof document === 'undefined') return

      // Patch existing file inputs
      patchFileInputs()

      // Watch for new file inputs (chat composer creates them dynamically)
      const observer = new MutationObserver(() => patchFileInputs())
      observer.observe(document.body, { childList: true, subtree: true })

      // Add drop zone to the chat area
      document.addEventListener('dragover', (e) => {
        const items = e.dataTransfer?.items
        if (!items) return
        for (const item of items) {
          if (item.kind === 'file') {
            e.preventDefault()
            break
          }
        }
      })

      document.addEventListener('drop', async (e) => {
        const files = e.dataTransfer?.files
        if (!files || files.length === 0) return
        // Check if this is NOT the chat input area (avoid double-handling)
        const target = e.target
        if (target && (target.closest('[contenteditable]') || target.closest('textarea') || target.closest('[data-composer]'))) return
        e.preventDefault()
        for (const file of files) {
          try {
            const result = await uploadFile(file)
            if (result && result.ok) {
              console.log(`dsh-file-attachment: uploaded ${file.name} (${(file.size / 1024).toFixed(1)}KB)`)
            }
          } catch (err) {
            console.warn(`dsh-file-attachment: failed to upload ${file.name}:`, err)
          }
        }
      })

      observer.__dfa = true
    }

    function dispose() {
      // Note: MutationObserver disposal is handled by ctx.effect
    }

    function apply(ctx) {
      if (ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => { setup(); return dispose }, 'dsh-file-attachment: patch')
      } else {
        setup()
      }
    }

    exports.apply = apply
    exports.inject = []
    return module.exports
  },
})