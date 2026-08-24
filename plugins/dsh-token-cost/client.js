// dsh-token-cost browser half (v1.0.0).
//
// A floating 💰 panel that shows live token usage and estimated cost for the
// current session:
//   - input tokens (uncached) / cache-read / cache-write / output tokens
//   - total tokens, context pressure (used / window)
//   - turns / steps / LLM time / tool time
//   - estimated cost in USD (and ≈CNY), computed from a configurable price
//     table keyed by model name (falls back to a default estimate).
//
// Data sources (dsh-client-runtime / dsh-client-connection):
//   - binding.session.projections.get("tokenUsage") / "contextPressure" /
//     "sessionStats" — host-computed session projections
//   - binding.session.projections.subscribeAny(...) — live updates
//   - binding.session.models?.() — current { provider, model }
//   - sessions.selection — currently open session
//
// Everything is defensive: if an API is missing, the panel shows what it can
// and never throws.

window.__ModuleLoader__.load({
  id: 'dsh-token-cost',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    // Try to load the runtime sessions API directly (bypasses inject)
    let runtimeSessions = null
    try {
      const rt = require('@deepseek-ai/dsh-client-runtime/client')
      runtimeSessions = rt && rt.sessions || null
    } catch { /* require not available */ }

    // ── configurable price table (USD per 1M tokens) ──────────────────────
    // Prices are estimates to be adjusted to the provider's current rates.
    // Unknown models fall back to `default`. Key by model name (lowercase).
    const PRICES = {
      default: { input: 0.5, output: 1.5, cacheRead: 0.05, cacheWrite: 0.5 },
      // DeepSeek 系列（估算，请以官方价格为准）
      'deepseek-v4-flash': { input: 0.14, output: 0.28, cacheRead: 0.014, cacheWrite: 0.14 },
      'deepseek-v4-pro': { input: 0.56, output: 1.68, cacheRead: 0.056, cacheWrite: 0.56 },
      'deepseek-v4': { input: 0.56, output: 1.68, cacheRead: 0.056, cacheWrite: 0.56 },
      'deepseek-chat': { input: 0.27, output: 1.1, cacheRead: 0.07, cacheWrite: 0.27 },
      'deepseek-reasoner': { input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0.55 },
      'deepseek-v3': { input: 0.27, output: 1.1, cacheRead: 0.07, cacheWrite: 0.27 },
      // MiniMax（估算）
      'minimax-m2.5': { input: 0.4, output: 1.2, cacheRead: 0.04, cacheWrite: 0.4 },
      'minimax-text-01': { input: 0.2, output: 1.1, cacheRead: 0.02, cacheWrite: 0.2 },
      // OpenAI（常见，参考价）
      'gpt-4o': { input: 2.5, output: 10, cacheRead: 1.25, cacheWrite: 2.5 },
      'gpt-4o-mini': { input: 0.15, output: 0.6, cacheRead: 0.075, cacheWrite: 0.15 },
      'gpt-4.1': { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 2 },
      'gpt-4.1-mini': { input: 0.4, output: 1.6, cacheRead: 0.1, cacheWrite: 0.4 },
      // Anthropic（参考价）
      'claude-3-7-sonnet': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      'claude-3-5-sonnet': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
      // Google（参考价）
      'gemini-2-5-flash': { input: 0.3, output: 2.5, cacheRead: 0.075, cacheWrite: 0.3 },
      'gemini-2-5-pro': { input: 1.25, output: 10, cacheRead: 0.3125, cacheWrite: 1.25 }
    }
    const CNY_PER_USD = 7.2

    // ── styles ────────────────────────────────────────────────────────────
    const CSS =
      '.dtc-root{position:fixed;right:16px;bottom:140px;z-index:9998;display:flex;flex-direction:column;align-items:flex-end;gap:8px;font-size:12px;line-height:18px;font-family:inherit}' +
      '.dtc-toggle{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;border:1px solid rgba(127,127,127,.4);background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#111);font-size:12px;line-height:18px;font-family:inherit;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.18);user-select:none;opacity:.92;transition:opacity .15s ease}' +
      '.dtc-toggle:hover{opacity:1}' +
      '.dtc-toggle[data-open="true"]{opacity:1}' +
      '.dtc-panel{width:264px;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid rgba(127,127,127,.35);background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,#111);box-shadow:0 8px 28px rgba(0,0,0,.22)}' +
      '.dtc-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-weight:600}' +
      '.dtc-close{flex:none;border:none;background:none;color:var(--dsw-alias-label-tertiary,#888);cursor:pointer;font-size:14px;line-height:14px;padding:2px 4px;border-radius:6px}' +
      '.dtc-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(0,0,0,.06))}' +
      '.dtc-grid{display:grid;grid-template-columns:auto 1fr;gap:3px 12px}' +
      '.dtc-label{color:var(--dsw-alias-label-tertiary,#888)}' +
      '.dtc-value{text-align:right;color:var(--dsw-alias-label-primary,#111);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dtc-model{font-family:var(--ds-font-family-code,monospace);font-size:11px}' +
      '.dtc-total{font-weight:600}' +
      '.dtc-cost{font-weight:600;color:var(--dsw-alias-state-business-primary,#2563eb)}' +
      '.dtc-empty{color:var(--dsw-alias-label-tertiary,#888);padding:4px 0}'

    // ── helpers ───────────────────────────────────────────────────────────
    function fmtTokens(n) {
      if (!Number.isFinite(n) || n <= 0) return '0'
      if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
      if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
      return String(Math.round(n))
    }
    function fmtUsd(c) {
      if (!Number.isFinite(c) || c <= 0) return '$0.0000'
      if (c >= 1) return '$' + c.toFixed(2)
      return '$' + c.toFixed(4)
    }
    function fmtSec(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return '0s'
      if (ms >= 60000) return (ms / 60000).toFixed(1) + 'm'
      return (ms / 1000).toFixed(1) + 's'
    }
    function priceFor(modelName) {
      const key = String(modelName || '').toLowerCase()
      return PRICES[key] || PRICES.default
    }
    function costOf(usage, modelName) {
      const p = priceFor(modelName)
      const input = (usage.uncachedInputTokens ?? 0) / 1e6 * p.input
      const cacheRead = (usage.cacheReadTokens ?? 0) / 1e6 * p.cacheRead
      const cacheWrite = (usage.cacheWriteTokens ?? 0) / 1e6 * p.cacheWrite
      const output = (usage.outputTokens ?? 0) / 1e6 * p.output
      return {
        total: input + cacheRead + cacheWrite + output,
        input,
        cacheRead,
        cacheWrite,
        output,
        usingDefault: !modelName || !PRICES[String(modelName).toLowerCase()]
      }
    }

    // ── state ─────────────────────────────────────────────────────────────
    let rootEl = null
    let toggleEl = null
    let panelEl = null
    let open = false
    let sessionId = null
    let binding = null
    let unsubscribeProjections = null
    let unsubscribeSelection = null
    let modelName = null
    let modelProvider = null
    let modelResolved = false

    // ── rendering ─────────────────────────────────────────────────────────
    function readUsage() {
      if (!binding || !binding.session || !binding.session.projections) return {}
      const proj = binding.session.projections
      return {
        tokenUsage: proj.get('tokenUsage') || {},
        contextPressure: proj.get('contextPressure') || {},
        sessionStats: proj.get('sessionStats') || {}
      }
    }

    function render() {
      if (!toggleEl || !panelEl) return
      const { tokenUsage = {}, contextPressure = {}, sessionStats = {} } = readUsage()
      const usage = tokenUsage
      const totalTokens = (usage.uncachedInputTokens ?? 0) + (usage.outputTokens ?? 0) +
        (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
      const cost = costOf(usage, modelName)

      // Toggle summary
      toggleEl.textContent = '💰 ' + fmtTokens(totalTokens) + ' tok · ' + fmtUsd(cost.total)
      toggleEl.dataset.open = String(open)

      if (!open) return

      // Panel rows
      const rows = []
      rows.push(['模型', (modelProvider ? modelProvider + '/' : '') + (modelName || '未知')])
      rows.push(['输入（非缓存）', fmtTokens(usage.uncachedInputTokens ?? 0)])
      rows.push(['缓存读 / 写', fmtTokens(usage.cacheReadTokens ?? 0) + ' / ' + fmtTokens(usage.cacheWriteTokens ?? 0)])
      rows.push(['输出', fmtTokens(usage.outputTokens ?? 0)])
      rows.push(['总计', fmtTokens(totalTokens)])
      const pressure = contextPressure.pressureTokens
      const window = contextPressure.contextWindow
      rows.push(['上下文', pressure != null
        ? (window != null ? Math.round(pressure / window * 100) + '%（' + fmtTokens(pressure) + ' / ' + fmtTokens(window) + '）' : fmtTokens(pressure) + ' tok')
        : '—'])
      rows.push(['轮 / 步', (sessionStats.turns ?? 0) + ' / ' + (sessionStats.steps ?? 0)])
      rows.push(['LLM / 工具耗时', fmtSec(sessionStats.llmMs ?? 0) + ' / ' + fmtSec(sessionStats.toolMs ?? 0)])
      rows.push(['成本（输入）', fmtUsd(cost.input) + ' + 缓存 ' + fmtUsd(cost.cacheRead + cost.cacheWrite)])
      rows.push(['成本（输出）', fmtUsd(cost.output)])
      rows.push(['估算成本', fmtUsd(cost.total) + ' ≈ ¥' + (cost.total * CNY_PER_USD).toFixed(2)])

      panelEl.querySelectorAll('.dtc-row').forEach((row) => row.remove())
      for (const [label, value] of rows) {
        const row = document.createElement('div')
        row.className = 'dtc-row'
        row.style.cssText = 'display:contents'
        const l = document.createElement('span')
        l.className = 'dtc-label'
        l.textContent = label
        const v = document.createElement('span')
        v.className = 'dtc-value'
        v.textContent = value
        if (label === '总计') v.classList.add('dtc-total')
        if (label === '估算成本') v.classList.add('dtc-cost')
        if (label === '模型') v.classList.add('dtc-model')
        row.appendChild(l)
        row.appendChild(v)
        panelEl.querySelector('.dtc-grid').appendChild(row)
      }
      if (cost.usingDefault && modelName) {
        let hint = panelEl.querySelector('.dtc-hint')
        if (!hint) {
          hint = document.createElement('div')
          hint.className = 'dtc-hint'
          hint.style.cssText = 'margin-top:6px;color:var(--dsw-alias-label-tertiary,#888);font-size:11px;line-height:16px'
          panelEl.appendChild(hint)
        }
        hint.textContent = '⚠ 该模型无价格表，按默认价估算'
      }
      // Debug row
      let dbg = panelEl.querySelector('.dtc-debug')
      if (!dbg) {
        dbg = document.createElement('div')
        dbg.className = 'dtc-debug'
        dbg.style.cssText = 'margin-top:4px;padding-top:4px;border-top:1px solid var(--dsw-alias-border-l2,rgba(0,0,0,.08));font-size:10px;line-height:14px;color:var(--dsw-alias-label-tertiary,#aaa);word-break:break-all'
        panelEl.appendChild(dbg)
      }
      dbg.textContent = 'sid: ' + (sessionId || '—') + ' | ' + (debugInfo || '—')
    }

    // ── data plumbing ─────────────────────────────────────────────────────
    let debugInfo = ''

    async function resolveModel() {
      modelResolved = false
      modelName = null
      modelProvider = null
      debugInfo = ''
      // Try 1: binding.session.models()
      try {
        if (binding && binding.session && typeof binding.session.models === 'function') {
          const res = await binding.session.models()
          const current = res && res.current
          if (current && current.model) {
            modelName = current.model
            modelProvider = current.provider
            modelResolved = true
            debugInfo = 'models() ✓'
          }
        }
      } catch { debugInfo = 'models() threw' }
      // Try 2: history fallback
      if (!modelResolved) {
        try {
          if (binding && binding.session && typeof binding.session.history === 'function') {
            const res = await binding.session.history({ direction: 'backward', limit: 5, beforeSeq: undefined })
            const events = res && res.events || []
            for (const entry of events) {
              const ev = entry && entry.event
              if (ev && ev.type === 'request/context' && ev.data && ev.data.model) {
                modelName = ev.data.model
                modelResolved = true
                debugInfo = 'history ✓'
                break
              }
            }
            if (!modelResolved) debugInfo = 'history: no model event'
          }
        } catch { debugInfo = debugInfo || 'history threw' }
      }
      // Try 3: scan binding.session for any model-like prop
      if (!modelResolved && binding && binding.session) {
        try {
          const s = binding.session
          if (s.model) { modelName = s.model; modelResolved = true; debugInfo = 'session.model ✓' }
          else if (s.currentModel) { modelName = s.currentModel; modelResolved = true; debugInfo = 'session.currentModel ✓' }
        } catch {}
      }
      render()
    }

    function findSessionId() {
      if (sessionId) return sessionId  // already found, don't overwrite debugInfo
      if (!ctxSessions) { debugInfo = 'no ctxSessions'; return null }
      // Dump keys once
      try {
        const keys = Object.keys(ctxSessions).filter(k => typeof ctxSessions[k] !== 'function').slice(0, 8)
        debugInfo = 'ctx keys: ' + (keys.length ? keys.join(',') : '(none)')
      } catch {}
      // Try selection
      try {
        const sel = ctxSessions.selection
        if (sel) {
          let v = null
          if (typeof sel.get === 'function') v = sel.get()
          else if (typeof sel.getState === 'function') v = sel.getState()
          else if (sel.value !== undefined) v = sel.value
          else if (sel.current !== undefined) v = typeof sel.current === 'function' ? sel.current() : sel.current
          if (typeof v === 'string') { debugInfo = 'sel→string'; return v }
          if (v && typeof v === 'object') {
            if (typeof v.current === 'string') { debugInfo = 'sel→obj.cur'; return v.current }
            if (typeof v.sessionId === 'string') { debugInfo = 'sel→obj.sid'; return v.sessionId }
          }
        }
      } catch {}
      // Try list
      try {
        const list = ctxSessions.list
        if (list) {
          let v = null
          if (typeof list.get === 'function') v = list.get()
          else if (typeof list.getState === 'function') v = list.getState()
          else if (list.value !== undefined) v = list.value
          const items = Array.isArray(v) ? v : (v && Array.isArray(v.items) ? v.items : (v && Array.isArray(v.sessions) ? v.sessions : []))
          for (const item of items) {
            const id = item && (item.sessionId || item.id)
            if (typeof id === 'string') { debugInfo = 'list[' + items.indexOf(item) + ']'; return id }
          }
          if (items.length === 0) debugInfo = 'list empty'
        }
      } catch {}
      return null
    }

    function attachSession(nextId) {
      if (nextId === sessionId && binding) return
      sessionId = nextId
      if (unsubscribeProjections) { unsubscribeProjections(); unsubscribeProjections = null }
      binding = null
      if (!sessionId) { debugInfo = 'no sid'; render(); return }
      const src = (ctxSessions && typeof ctxSessions.binding === 'function') ? ctxSessions :
                  (runtimeSessions && typeof runtimeSessions.binding === 'function') ? runtimeSessions : null
      if (!src) { debugInfo = 'no sessions src'; render(); return }
      try {
        binding = src.binding(sessionId)
      } catch (e) {
        binding = null
        debugInfo = 'binding err: ' + (e && e.message ? String(e.message).slice(0, 30) : '?')
        render(); return
      }
      if (!binding || !binding.session) { debugInfo = 'no binding.session'; render(); return }
      const proj = binding.session.projections
      if (!proj) { debugInfo = 'no projections'; render(); return }
      // Enumerate what's actually in the projection store
      try {
        const projKeys = typeof proj.values === 'function' ? Object.keys(proj.values() || {}) :
                         typeof proj.keys === 'function' ? [...proj.keys()] : []
        const tu = typeof proj.get === 'function' ? proj.get('tokenUsage') :
                   typeof proj.faceOf === 'function' ? (() => { try { return proj.faceOf('tokenUsage')?.value } catch { return null } })() : null
        debugInfo = 'proj keys[' + projKeys.length + ']: ' + (projKeys.slice(0,4).join(',') || '(none)') + (tu ? ' ✓' : ' ∅')
      } catch { debugInfo = 'proj enum err' }
      try {
        unsubscribeProjections = proj.subscribeAny ? proj.subscribeAny(() => render()) : null
      } catch {}
      void resolveModel()
      render()
    }

    let ctxSessions = null
    let retryTimer = null

    function tryAttach() {
      const id = findSessionId()
      if (id) {
        attachSession(id)
        if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
      } else if (!retryTimer) {
        retryTimer = setTimeout(tryAttach, 2000)
      }
    }

    function setup() {
      if (typeof document === 'undefined' || rootEl) return

      rootEl = document.createElement('div')
      rootEl.className = 'dtc-root'

      toggleEl = document.createElement('button')
      toggleEl.type = 'button'
      toggleEl.className = 'dtc-toggle'
      toggleEl.textContent = '💰 …'
      toggleEl.addEventListener('click', () => {
        open = !open
        if (panelEl) panelEl.hidden = !open
        render()
      })

      panelEl = document.createElement('div')
      panelEl.className = 'dtc-panel'
      panelEl.hidden = true

      const head = document.createElement('div')
      head.className = 'dtc-head'
      const title = document.createElement('span')
      title.textContent = '💰 Token 成本'
      const close = document.createElement('button')
      close.type = 'button'
      close.className = 'dtc-close'
      close.textContent = '×'
      close.title = '收起'
      close.addEventListener('click', () => {
        open = false
        panelEl.hidden = true
        render()
      })
      head.appendChild(title)
      head.appendChild(close)

      const grid = document.createElement('div')
      grid.className = 'dtc-grid'

      panelEl.appendChild(head)
      panelEl.appendChild(grid)
      rootEl.appendChild(panelEl)
      rootEl.appendChild(toggleEl)
      document.body.appendChild(rootEl)

      const style = document.createElement('style')
      style.dataset.plugin = 'dsh-token-cost'
      style.dataset.pluginCss = 'dsh-token-cost/panel'
      style.textContent = CSS
      document.head.appendChild(style)
      rootEl.dataset.styleTag = ''
      rootEl.__style = style

      // Try to find the current session (with retry if not ready yet)
      if (ctxSessions) {
        try {
          const sel = ctxSessions.selection
          if (sel) {
            // Subscribe to future changes
            if (typeof sel.subscribe === 'function') {
              unsubscribeSelection = sel.subscribe((value) => {
                const id = typeof value === 'string' ? value : (value && (value.current || value.sessionId || value.id))
                if (id && id !== sessionId) { attachSession(id); debugInfo = 'sub→' + String(id).slice(-8) }
              })
            }
            // Immediately read current value (subscribe only fires on changes)
            let v = null
            try { if (typeof sel.get === 'function') v = sel.get() } catch {}
            if (v === null || v === undefined) try { if (typeof sel.getState === 'function') v = sel.getState() } catch {}
            if (v === null || v === undefined) try { v = sel.value } catch {}
            if (v === null || v === undefined) try { v = typeof sel.current === 'function' ? sel.current() : sel.current } catch {}
            const id = typeof v === 'string' ? v : (v && (v.current || v.sessionId || v.id))
            if (id) { debugInfo = 'sel init→' + String(id).slice(-8); attachSession(id) }
            else debugInfo = 'sel init: ' + (v === null || v === undefined ? 'null' : JSON.stringify(v).slice(0,30))
          }
        } catch {}
      }
      // Fallback: retry polling if session not found yet
      tryAttach()
      render()
    }

    function dispose() {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
      if (unsubscribeProjections) { unsubscribeProjections(); unsubscribeProjections = null }
      if (unsubscribeSelection) { unsubscribeSelection(); unsubscribeSelection = null }
      if (rootEl) {
        if (rootEl.__style) rootEl.__style.remove()
        rootEl.remove()
      }
      rootEl = null
      toggleEl = null
      panelEl = null
      binding = null
      sessionId = null
    }

    function apply(ctx) {
      ctxSessions = ctx && ctx.sessions ? ctx.sessions : null
      if (ctx && typeof ctx.effect === 'function') {
        ctx.effect(() => {
          setup()
          return dispose
        }, 'dsh-token-cost: panel')
      } else {
        setup()
      }
    }

    exports.apply = apply
    exports.inject = ['sessions']
    return module.exports
  },
})
