// dsh-hide-tool-noise server half.
//
// A minimal Cordis plugin whose only job is to be loaded as a profile bundle.
// That makes dsh-client-modules scan this package's `dsh.client` declaration
// and serve ./client.js (the CSS-injection browser half) to the web UI.
// There is deliberately no server-side behavior.

const name = 'dsh-hide-tool-noise'

function apply() {
  // no-op: all behavior lives in the browser half (client.js)
}

export { name, apply }
