/**
 * Socket.IO Server Example
 *
 * Demonstrates WebSocketJSONStream with Socket.IO including
 * full configuration options for production use.
 *
 * Install: pnpm add socket.io
 * Run: npx tsx examples/socketio-server.ts
 */

import http from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'

const PORT = 8082

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
    <head><title>Socket.IO Server</title></head>
    <body>
      <h1>Socket.IO Server Running</h1>
      <p>Connect to: <code>http://localhost:${PORT}</code></p>
      <p>Health check: <a href="/health">/health</a></p>
    </body>
    </html>
  `)
})

// ============================================================
// Socket.IO Server Configuration
// ============================================================
const io = new SocketIOServer(httpServer, {
  // CORS configuration for browser clients
  cors: {
    origin: '*', // In production, specify exact origins
    methods: ['GET', 'POST'],
  },

  // Transport configuration
  transports: ['websocket', 'polling'], // WebSocket first, then HTTP polling fallback

  // Ping timeout (how long to wait for pong before considering connection closed)
  pingTimeout: 20000,

  // Ping interval (how often to send ping frames)
  pingInterval: 25000,

  // Connection timeout (how long to wait for initial connection)
  connectTimeout: 45000,

  // Allow upgrades from polling to websocket
  allowUpgrades: true,

  // Per-message deflate compression
  perMessageDeflate: {
    threshold: 1024, // Only compress messages larger than 1KB
  },
})

// ============================================================
// Connection Handling
// ============================================================
io.on('connection', (socket) => {
  const clientInfo = {
    id: socket.id,
    address: socket.handshake.address,
    transport: socket.conn.transport.name,
  }
  console.log('Client connected:', clientInfo)

  // Create JSON stream with explicit socketio adapter
  const stream = new WebSocketJSONStream(socket, 'socketio')

  stream.on('data', (data) => {
    console.log(`[${socket.id}] Received:`, data)

    // Echo back with metadata
    stream.write({
      echo: data,
      transport: socket.conn.transport.name,
      timestamp: Date.now(),
    })
  })

  stream.on('error', (error) => {
    console.error(`[${socket.id}] Stream error:`, error.message)
  })

  stream.on('close', () => {
    console.log(`[${socket.id}] Stream closed`)
  })

  // Handle transport upgrade
  socket.conn.on('upgrade', (transport) => {
    console.log(`[${socket.id}] Transport upgraded to:`, transport.name)
  })

  socket.on('disconnect', (reason) => {
    console.log(`[${socket.id}] Client disconnected:`, reason)
  })
})

// ============================================================
// Namespace Example (optional)
// ============================================================
const chatNamespace = io.of('/chat')

chatNamespace.on('connection', (socket) => {
  console.log(`[/chat] Client connected: ${socket.id}`)

  const stream = new WebSocketJSONStream(socket, 'socketio')

  stream.on('data', (data) => {
    // Broadcast to all clients in the namespace (except sender)
    const message = {
      from: socket.id,
      data: data,
      timestamp: Date.now(),
    }

    // Echo to sender
    stream.write(message)

    // Broadcast to others using native Socket.IO
    socket.broadcast.emit('message', JSON.stringify(message))
  })

  socket.on('disconnect', () => {
    console.log(`[/chat] Client disconnected: ${socket.id}`)
  })
})

// ============================================================
// Start Server
// ============================================================
httpServer.listen(PORT, () => {
  console.log(`
============================================================
Socket.IO Server Started
============================================================
Endpoint: http://localhost:${PORT}
Health:   http://localhost:${PORT}/health

Namespaces:
  /        - Default namespace (echo server)
  /chat    - Chat namespace (broadcast example)

Supported transports (in priority order):
  1. websocket
  2. polling (HTTP long-polling)

Run client: npx tsx examples/socketio-client.ts
============================================================
  `)
})
