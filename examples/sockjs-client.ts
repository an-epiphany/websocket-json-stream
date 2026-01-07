/**
 * SockJS Client Example (sockjs-client)
 *
 * Demonstrates connecting to a SockJS server using native sockjs-client API.
 * No WebSocketJSONStream needed on client side.
 *
 * Install: pnpm add sockjs-client
 * Run: npx tsx examples/sockjs-client.ts
 *
 * Note: Start the server first with:
 *   npx tsx examples/sockjs-server.ts
 */

import SockJS from 'sockjs-client'

const SERVER_URL = 'http://localhost:8081/sockjs'

// ============================================================
// SockJS Client Configuration
// ============================================================
const sock = new SockJS(SERVER_URL, null, {
  // Transport priority (first available will be used)
  // Options: 'websocket', 'xhr-streaming', 'xhr-polling',
  //          'eventsource', 'htmlfile', 'jsonp-polling'
  transports: ['websocket', 'xhr-streaming', 'xhr-polling'],

  // Session ID generator (for debugging/tracking)
  sessionId: () => {
    return Math.random().toString(36).substring(2, 15)
  },

  // Timeout for connection attempt (milliseconds)
  timeout: 5000,
})

// ============================================================
// Connection Event Handlers
// ============================================================
sock.onopen = () => {
  console.log('Connected to SockJS server')
  console.log('Transport:', (sock as any).transport)

  // Send JSON messages directly using native API
  sock.send(JSON.stringify({ type: 'ping', message: 'Hello from SockJS client!' }))
  sock.send(JSON.stringify({ type: 'data', values: [1, 2, 3, 4, 5] }))

  // Close after 5 seconds
  setTimeout(() => {
    console.log('Closing connection...')
    sock.close()
  }, 5000)
}

sock.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('Received:', message)
}

sock.onerror = (error) => {
  console.error('SockJS error:', error)
}

sock.onclose = () => {
  console.log('Disconnected from SockJS server')
  process.exit(0)
}

// ============================================================
// Transport Fallback Scenarios
// ============================================================
/*
Transport selection depends on:

1. Server configuration
2. Network conditions (firewalls, proxies)

Priority order (default):
  websocket       - Best performance, full-duplex
  xhr-streaming   - Good for environments behind proxies
  xhr-polling     - Works everywhere, higher latency
  eventsource     - Server-Sent Events based
  htmlfile        - IE-specific streaming
  jsonp-polling   - Legacy, cross-domain without CORS

Example: Force HTTP-only (no WebSocket):
  transports: ['xhr-polling', 'jsonp-polling']

Example: Prefer streaming over polling:
  transports: ['websocket', 'xhr-streaming', 'eventsource', 'xhr-polling']
*/
