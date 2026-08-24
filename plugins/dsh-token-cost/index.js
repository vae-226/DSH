// dsh-token-cost server half — a minimal Cordis plugin whose only job is to be
// loaded as a profile bundle so dsh-client-modules scans this package's
// `dsh.client` declaration and serves ./client.js to the web UI.

const name = 'dsh-token-cost'

function apply() {
  // no-op: all behavior lives in the browser half (client.js)
}

export { name, apply }
