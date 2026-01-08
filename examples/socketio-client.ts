/**
 * Socket.IO Client Example
 *
 * Demonstrates connecting to a Socket.IO server using native socket.io-client API.
 * No WebSocketJSONStream needed on client side.
 *
 * Install: pnpm add socket.io-client
 * Run: npx tsx examples/socketio-client.ts
 *
 * Note: Start the server first with:
 *   npx tsx examples/socketio-server.ts
 */

import { io } from 'socket.io-client'

const SERVER_URL = 'http://localhost:8082'

// ============================================================
// Socket.IO Client Configuration
// ============================================================
const socket = io(SERVER_URL, {
  // Transport configuration
  // Options: 'websocket', 'polling'
  transports: ['websocket', 'polling'],

  // Reconnection settings
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,

  // Timeout for connection attempt
  timeout: 20000,

  // Auto connect (set to false if you want to call socket.connect() manually)
  autoConnect: true,
})

// ============================================================
// Connection Event Handlers
// ============================================================
socket.on('connect', () => {
  console.log('Connected to Socket.IO server')
  console.log('Socket ID:', socket.id)
  console.log('Transport:', socket.io.engine.transport.name)

  // Send JSON messages using native API
  // The server's WebSocketJSONStream will receive these via 'message' event
  socket.emit('message', JSON.stringify({ type: 'ping', message: 'Hello from Socket.IO client!' }))
  socket.emit('message', JSON.stringify({ type: 'data', values: [1, 2, 3, 4, 5] }))

  // Close after 5 seconds
  setTimeout(() => {
    console.log('Closing connection...')
    socket.disconnect()
  }, 5000)
})

// Receive messages from server's WebSocketJSONStream
socket.on('message', (data: string) => {
  const message = JSON.parse(data)
  console.log('Received:', message)
})

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message)
})

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason)
  process.exit(0)
})

// Handle transport upgrade
socket.io.engine.on('upgrade', (transport) => {
  console.log('Transport upgraded to:', transport.name)
})

// ============================================================
// Chat Namespace Example
// ============================================================
/*
// Connect to the /chat namespace
const chatSocket = io(`${SERVER_URL}/chat`, {
  transports: ['websocket', 'polling'],
})

chatSocket.on('connect', () => {
  console.log('Connected to /chat namespace')
  console.log('Socket ID:', chatSocket.id)

  // Send a chat message
  chatSocket.emit('message', JSON.stringify({ content: 'Hello, chat!' }))
})

chatSocket.on('message', (data: string) => {
  const message = JSON.parse(data)
  console.log('[Chat] Message:', message)
})

chatSocket.on('disconnect', () => {
  console.log('Disconnected from /chat namespace')
})
*/

// ============================================================
// Transport Selection Notes
// ============================================================
/*
Transport selection depends on:

1. Server configuration
2. Network conditions (firewalls, proxies)
3. Client configuration

Priority order (default):
  websocket   - Best performance, full-duplex, low latency
  polling     - HTTP long-polling, works everywhere, higher latency

Example: Force WebSocket only (no fallback):
  transports: ['websocket']

Example: Force polling only (for testing):
  transports: ['polling']

Socket.IO will automatically:
  - Start with the first available transport
  - Upgrade from polling to websocket when possible
  - Handle reconnection with exponential backoff
*/
