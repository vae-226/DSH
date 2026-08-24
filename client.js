// dsh-hide-tool-noise browser half (v1.1.0).
//
// Injects a stylesheet that hides "noise" rows in the DSH Web chat flow:
//   - tool-call cards (Pwsh / Read / Write / Edit / Search / ...)
//   - tool-result rows
//   - Think (reasoning) disclosure rows
//   - context-injection rows (e.g. subagent / skill / workspace injection logs)
//
// A small floating toggle button (bottom-right, above the composer) switches
// the hiding on/off at any time; the state persists in localStorage.
//
// These rows carry stable data attributes in the dsh-web-frontend rendering:
//   - [data-chat-flow-kind="tool-call"]   — one tool call flow item
//   - [data-chat-flow-kind="tool-result"] — a tool result flow item
//   - [data-chat-anchor-key^="call:"]     — the ToolCall inner row (belt & braces)
//   - [data-variant="think"]              — ReasoningRow (Think disclosure)
//   - [data-chat-flow-kind="context"]     — ContextInjectionRow (context injection)
//
// Only user-visible rows are hidden; the DOM and the session model are
// untouched, so paging/anchor logic keeps working.

window.__ModuleLoader__.load({
  id: 'dsh-hide-tool-noise',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const STORAGE_KEY = 'dsh-hide-tool-noise:enabled'
    const DEFAULT_ENABLED = true

    // Rules that actually hide chat-flow noise (toggled on/off).
    const NOISE_CSS =
      '[data-chat-flow-kind="tool-call"],' +
      '[data-chat-flow-kind="tool-result"],' +
      '[data-chat-anchor-key^="call:"],' +
      '[data-variant="think"],' +
      '[data-chat-flow-kind="context"]' +
      '{display:none!important}'

    // Styles for the toggle button itself (always present).
    const BTN_CSS =
      '.dsh-htn-toggle{' +
      'position:fixed;right:16px;bottom:104px;z-index:9999;' +
      'display:inline-flex;align-items:center;gap:4px;' +
      'padding:5px 12px;border-radius:999px;' +
      'border:1px solid rgba(127,127,127,.4);' +
      'background:var(--dsw-alias-bg-layer-2,#fff);' +
      'color:var(--dsw-alias-label-primary,#111);' +
      'font-size:12px;line-height:18px;font-family:inherit;' +
      'cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18);' +
      'user-select:none;opacity:.92;transition:opacity .15s ease' +
      '}' +
      '.dsh-htn-toggle:hover{opacity:1}' +
      '.dsh-htn-toggle[data-on="false"]{opacity:.55}'

    let noiseStyle = null
    let buttonStyle = null
    let buttonEl = null
    let enabled = readEnabled()

    function readEnabled() {
      if (typeof localStorage === 'undefined') return DEFAULT_ENABLED
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw === null ? DEFAULT_ENABLED : raw !== '0'
      } catch {
        return DEFAULT_ENABLED
      }
    }

    function syncNoiseStyle() {
      if (noiseStyle) noiseStyle.textContent = enabled ? NOISE_CSS : ''
    }

    function syncButton() {
      if (!buttonEl) return
      buttonEl.textContent = enabled ? '🧹 隐藏命令：开' : '🧹 隐藏命令：关'
      buttonEl.dataset.on = String(enabled)
      buttonEl.title = enabled ? '点击关闭命令隐藏' : '点击开启命令隐藏'
    }

    function installUI() {
      if (typeof document === 'undefined' || noiseStyle || buttonEl) return

      noiseStyle = document.createElement('style')
      noiseStyle.dataset.plugin = 'dsh-hide-tool-noise'
      noiseStyle.dataset.pluginCss = 'dsh-hide-tool-noise/chat-noise'
      document.head.appendChild(noiseStyle)

      buttonStyle = document.createElement('style')
      buttonStyle.dataset.plugin = 'dsh-hide-tool-noise'
      buttonStyle.dataset.pluginCss = 'dsh-hide-tool-noise/toggle-button'
      buttonStyle.textContent = BTN_CSS
      document.head.appendChild(buttonStyle)

      buttonEl = document.createElement('button')
      buttonEl.type = 'button'
      buttonEl.className = 'dsh-htn-toggle'
      buttonEl.addEventListener('click', () => {
        enabled = !enabled
        try {
          localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
        } catch { /* storage unavailable: session-only toggle */ }
        syncNoiseStyle()
        syncButton()
      })
      document.body.appendChild(buttonEl)

      syncNoiseStyle()
      syncButton()
    }

    function dispose() {
      if (noiseStyle) { noiseStyle.remove(); noiseStyle = null }
      if (buttonStyle) { buttonStyle.remove(); buttonStyle = null }
      if (buttonEl) { buttonEl.remove(); buttonEl = null }
    }

    function apply(ctx) {
      if (ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => {
          installUI()
          return dispose
        }, 'dsh-hide-tool-noise: chat noise toggle')
      } else {
        installUI()
      }
    }

    exports.apply = apply
    exports.inject = []
    return module.exports
  },
})
