/**
 * SockJS Server Example (sockjs-node)
 *
 * Demonstrates WebSocketJSONStream with sockjs-node including
 * full configuration options for production use.
 *
 * Install: pnpm add sockjs
 * Run: npx tsx examples/sockjs-server.ts
 */

import http from 'node:http'
import sockjs from 'sockjs'
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'

const PORT = 8081

// ============================================================
// SockJS Server Configuration
// ============================================================
const sockjsServer = sockjs.createServer({
  // URL prefix for SockJS endpoints
  prefix: '/sockjs',

  // URL to sockjs-client library (for iframe transports)
  sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js',

  // Allowed transports (comment out to allow all)
  // Options: 'websocket', 'xhr-streaming', 'xhr-polling',
  //          'eventsource', 'htmlfile', 'jsonp-polling'
  // websocket: false,  // Disable WebSocket to force HTTP fallback

  // Heartbeat interval (milliseconds)
  heartbeat_delay: 25000,

  // Time to wait for heartbeat response before disconnecting
  disconnect_delay: 5000,

  // Response size limit (bytes) - for streaming transports
  response_limit: 128 * 1024,

  // Custom logger
  log: (severity, message) => {
    const timestamp = new Date().toISOString()
    switch (severity) {
      case 'error':
        console.error(`[${timestamp}] [SockJS ERROR]`, message)
        break
      case 'info':
        console.info(`[${timestamp}] [SockJS INFO]`, message)
        break
      case 'debug':
        // Uncomment for verbose logging
        // console.debug(`[${timestamp}] [SockJS DEBUG]`, message)
        break
    }
  },
})

// ============================================================
// Connection Handling
// ============================================================
sockjsServer.on('connection', (conn) => {
  if (!conn) return // Handle null connection edge case

  const clientInfo = {
    id: conn.id,
    address: conn.remoteAddress,
    protocol: conn.protocol,  // Transport being used
  }
  console.log('Client connected:', clientInfo)

  // Create JSON stream with explicit sockjs-node adapter
  const stream = new WebSocketJSONStream(conn, 'sockjs-node')

  stream.on('data', (data) => {
    console.log(`[${conn.id}] Received:`, data)

    // Echo back with metadata
    stream.write({
      echo: data,
      transport: conn.protocol,
      timestamp: Date.now(),
    })
  })

  stream.on('error', (error) => {
    console.error(`[${conn.id}] Stream error:`, error.message)
  })

  stream.on('close', () => {
    console.log(`[${conn.id}] Client disconnected`)
  })
})

// ============================================================
// HTTP Server Setup
// ============================================================
const httpServer = http.createServer((req, res) => {
  // Simple health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  // Info page
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(`
    <!DOCTYPE html>
    <html>
    <head><title>SockJS Server</title></head>
    <body>
      <h1>SockJS Server Running</h1>
      <p>Connect to: <code>http://localhost:${PORT}/sockjs</code></p>
      <p>Health check: <a href="/health">/health</a></p>
    </body>
    </html>
  `)
})

// Install SockJS handlers on HTTP server
sockjsServer.installHandlers(httpServer)

httpServer.listen(PORT, () => {
  console.log(`
============================================================
SockJS Server Started
============================================================
Endpoint: http://localhost:${PORT}/sockjs
Health:   http://localhost:${PORT}/health

Supported transports (in priority order):
  1. websocket
  2. xhr-streaming
  3. xhr-polling
  4. eventsource
  5. htmlfile
  6. jsonp-polling

Run client: npx tsx examples/sockjs-client.ts
============================================================
  `)
})
