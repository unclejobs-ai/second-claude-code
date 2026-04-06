#!/usr/bin/env node
/**
 * SCC Artifact Viewer — zero-dependency HTTP + WebSocket server
 * Serves ui/dist and streams PDCA artifacts via WebSocket (RFC 6455).
 *
 * Usage:
 *   node server.cjs --session-dir /path/to/session --dist-dir /path/to/dist [--port 3847]
 *
 * Session directory structure:
 *   state.json           — PDCA session state
 *   artifacts/*.json     — artifact files (one per file or array)
 */

'use strict'

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

// --- CLI args ---
const args = process.argv.slice(2)
function getArg(name) {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null
}

const PORT = parseInt(getArg('port') || '3847', 10)
const SESSION_DIR = getArg('session-dir') || process.env.SCC_SESSION_DIR || '/tmp/scc-session'
const DIST_DIR = getArg('dist-dir') || path.resolve(__dirname, '..', 'dist')

// --- MIME types ---
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

// --- WebSocket helpers (RFC 6455) ---
function computeAcceptKey(key) {
  return crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-5AB5A3F11BA5')
    .digest('base64')
}

function encodeFrame(data) {
  const payload = Buffer.from(data, 'utf8')
  const len = payload.length
  let header

  if (len < 126) {
    header = Buffer.alloc(2)
    header[0] = 0x81 // FIN + TEXT
    header[1] = len
  } else if (len < 65536) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(len, 2)
  } else {
    header = Buffer.alloc(10)
    header[0] = 0x81
    header[1] = 127
    header.writeBigUInt64BE(BigInt(len), 2)
  }

  return Buffer.concat([header, payload])
}

function decodeFrame(buffer) {
  if (buffer.length < 2) return null

  const opcode = buffer[0] & 0x0f
  const masked = (buffer[1] & 0x80) !== 0
  let payloadLen = buffer[1] & 0x7f
  let offset = 2

  if (payloadLen === 126) {
    if (buffer.length < 4) return null
    payloadLen = buffer.readUInt16BE(2)
    offset = 4
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null
    payloadLen = Number(buffer.readBigUInt64BE(2))
    offset = 10
  }

  if (masked) {
    if (buffer.length < offset + 4 + payloadLen) return null
    const mask = buffer.slice(offset, offset + 4)
    offset += 4
    const payload = Buffer.alloc(payloadLen)
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = buffer[offset + i] ^ mask[i % 4]
    }
    return { opcode, payload: payload.toString('utf8'), totalLen: offset + payloadLen }
  }

  if (buffer.length < offset + payloadLen) return null
  const payload = buffer.slice(offset, offset + payloadLen).toString('utf8')
  return { opcode, payload, totalLen: offset + payloadLen }
}

// --- Server state ---
const wsClients = new Set()
let lastState = null
let lastArtifacts = []
const MAX_FRAME_BUFFER = 1024 * 1024 // 1MB cap per socket

// Cache index.html in memory for SPA fallback
let indexHtmlCache = null
try {
  indexHtmlCache = fs.readFileSync(path.join(DIST_DIR, 'index.html'))
} catch { /* will be null — 404 on SPA fallback */ }

function broadcast(msg) {
  const frame = encodeFrame(JSON.stringify(msg))
  for (const client of wsClients) {
    try { client.write(frame) } catch { wsClients.delete(client) }
  }
}

function sendToClient(socket, msg) {
  try {
    socket.write(encodeFrame(JSON.stringify(msg)))
  } catch { /* ignore */ }
}

// --- File watching ---
function readJsonSafe(filepath) {
  try {
    const raw = fs.readFileSync(filepath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Track file content hashes for efficient change detection
const fileHashes = new Map()

function hashString(str) {
  return crypto.createHash('md5').update(str).digest('hex')
}

function loadState() {
  const stateFile = path.join(SESSION_DIR, 'state.json')
  const state = readJsonSafe(stateFile)
  if (!state) return
  const hash = hashString(JSON.stringify(state))
  if (hash === fileHashes.get('state')) return
  fileHashes.set('state', hash)
  lastState = state
  broadcast({ type: 'state', payload: state })
}

function loadArtifacts() {
  const artifactsDir = path.join(SESSION_DIR, 'artifacts')
  let files
  try {
    files = fs.readdirSync(artifactsDir).filter((f) => f.endsWith('.json')).sort()
  } catch {
    return
  }

  const artifacts = []
  for (const file of files) {
    const data = readJsonSafe(path.join(artifactsDir, file))
    if (!data) continue
    if (Array.isArray(data)) {
      artifacts.push(...data)
    } else {
      artifacts.push(data)
    }
  }

  const hash = hashString(JSON.stringify(artifacts))
  if (hash === fileHashes.get('artifacts')) return
  fileHashes.set('artifacts', hash)

  const oldIds = new Set(lastArtifacts.filter((a) => a.id).map((a) => a.id))
  const newArtifacts = artifacts.filter((a) => a.id && !oldIds.has(a.id))
  lastArtifacts = artifacts

  if (newArtifacts.length > 0) {
    for (const artifact of newArtifacts) {
      broadcast({ type: 'artifact', payload: artifact })
    }
  } else {
    broadcast({ type: 'artifacts', payload: artifacts })
  }
}

function startWatching() {
  // Ensure session directory exists
  fs.mkdirSync(path.join(SESSION_DIR, 'artifacts'), { recursive: true })

  // Initial load
  loadState()
  loadArtifacts()

  // Watch for changes
  const watchers = []

  // Debounce watchers — fs.watch fires 2-4x per write on macOS/Linux
  let stateDebounce = null
  let artifactDebounce = null

  try {
    const stateWatcher = fs.watch(SESSION_DIR, (eventType, filename) => {
      if (filename === 'state.json') {
        clearTimeout(stateDebounce)
        stateDebounce = setTimeout(loadState, 80)
      }
    })
    watchers.push(stateWatcher)
  } catch { /* dir might not exist yet */ }

  try {
    const artifactWatcher = fs.watch(path.join(SESSION_DIR, 'artifacts'), () => {
      clearTimeout(artifactDebounce)
      artifactDebounce = setTimeout(loadArtifacts, 80)
    })
    watchers.push(artifactWatcher)
  } catch { /* dir might not exist yet */ }

  return watchers
}

// --- HTTP handler ---
function handleHttp(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // API endpoints
  if (req.url === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(lastState || {}))
    return
  }

  if (req.url === '/api/artifacts') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(lastArtifacts))
    return
  }

  // Static file serving
  let urlPath = req.url.split('?')[0]
  if (urlPath === '/') urlPath = '/index.html'

  // Security: resolve and verify path stays within DIST_DIR
  const filePath = path.resolve(DIST_DIR, '.' + urlPath)
  if (!filePath.startsWith(DIST_DIR + path.sep) && filePath !== DIST_DIR) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // Try to serve the file directly; fall back to SPA index on error
  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME[ext] || 'application/octet-stream'

  const stream = fs.createReadStream(filePath)
  stream.on('open', () => {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    stream.pipe(res)
  })
  stream.on('error', () => {
    // SPA fallback — serve cached index.html
    if (indexHtmlCache) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(indexHtmlCache)
    } else {
      res.writeHead(404)
      res.end('Not Found')
    }
  })
}

// --- WebSocket upgrade ---
function handleUpgrade(req, socket) {
  const key = req.headers['sec-websocket-key']
  if (!key) {
    socket.destroy()
    return
  }

  const acceptKey = computeAcceptKey(key)
  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '',
    '',
  ].join('\r\n')

  socket.write(responseHeaders)
  wsClients.add(socket)

  // Send current state and artifacts
  if (lastState) sendToClient(socket, { type: 'state', payload: lastState })
  if (lastArtifacts.length > 0) sendToClient(socket, { type: 'artifacts', payload: lastArtifacts })

  // Handle incoming frames
  let frameBuffer = Buffer.alloc(0)

  socket.on('data', (data) => {
    frameBuffer = Buffer.concat([frameBuffer, data])
    if (frameBuffer.length > MAX_FRAME_BUFFER) {
      wsClients.delete(socket)
      socket.destroy()
      return
    }

    while (frameBuffer.length >= 2) {
      const frame = decodeFrame(frameBuffer)
      if (!frame) break

      frameBuffer = frameBuffer.slice(frame.totalLen)

      if (frame.opcode === 0x08) {
        // Close
        wsClients.delete(socket)
        socket.end()
        return
      }

      if (frame.opcode === 0x09) {
        // Ping → Pong
        const pong = Buffer.alloc(2)
        pong[0] = 0x8a // FIN + PONG
        pong[1] = 0x00
        try { socket.write(pong) } catch { /* ignore */ }
        continue
      }

      // Text frame — handle app-level messages
      if (frame.opcode === 0x01) {
        try {
          const msg = JSON.parse(frame.payload)
          if (msg.type === 'pong') { /* keepalive ack */ }
        } catch { /* ignore */ }
      }
    }
  })

  socket.on('close', () => wsClients.delete(socket))
  socket.on('error', () => wsClients.delete(socket))
}

// --- Ping interval ---
function startPing() {
  return setInterval(() => {
    broadcast({ type: 'ping' })
  }, 30000)
}

// --- Auto-stop ---
let idleTimer = null
const IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    if (wsClients.size === 0) {
      console.log('[SCC Viewer] No clients connected for 5 minutes. Shutting down.')
      process.exit(0)
    }
    resetIdleTimer()
  }, IDLE_TIMEOUT)
}

// --- Main ---
const server = http.createServer(handleHttp)

server.on('upgrade', (req, socket) => {
  if (req.url === '/ws') {
    handleUpgrade(req, socket)
    resetIdleTimer()
  } else {
    socket.destroy()
  }
})

const watchers = startWatching()
const pingInterval = startPing()
resetIdleTimer()

server.listen(PORT, () => {
  console.log(`[SCC Artifact Viewer] http://localhost:${PORT}`)
  console.log(`[SCC Artifact Viewer] Session: ${SESSION_DIR}`)
  console.log(`[SCC Artifact Viewer] Dist: ${DIST_DIR}`)
})

// Graceful shutdown
function shutdown() {
  console.log('\n[SCC Viewer] Shutting down...')
  clearInterval(pingInterval)
  if (idleTimer) clearTimeout(idleTimer)
  for (const w of watchers) { try { w.close() } catch { /* ignore */ } }
  for (const client of wsClients) { try { client.end() } catch { /* ignore */ } }
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
