/**
 * SockJS Client Example (sockjs-client)
 *
 * Demonstrates WebSocketJSONStream with sockjs-client including
 * full configuration options and transport fallback.
 *
 * Install: pnpm add sockjs-client
 * Run: npx tsx examples/sockjs-client.ts
 *
 * Note: Start the server first with:
 *   npx tsx examples/sockjs-server.ts
 */

import SockJS from 'sockjs-client'
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'

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

  // sockjs-client uses standard WebSocket API
  // No special adapter needed - use default 'ws'
  const stream = new WebSocketJSONStream(sock)

  // Send test messages
  stream.write({ type: 'ping', message: 'Hello from SockJS client!' })
  stream.write({ type: 'data', values: [1, 2, 3, 4, 5] })

  stream.on('data', (response) => {
    console.log('Received:', response)
  })

  stream.on('error', (error) => {
    console.error('Stream error:', error.message)
  })

  stream.on('close', () => {
    console.log('Stream closed')
  })

  // Close after 5 seconds
  setTimeout(() => {
    console.log('Closing connection...')
    stream.end()
  }, 5000)
}

sock.onerror = (error) => {
  console.error('SockJS error:', error)
}

sock.onclose = () => {
  console.log('Disconnected from SockJS server')
  process.exit(0)
}

// ============================================================
// Browser Usage Example (for reference)
// ============================================================
/*
<!-- In browser, include sockjs-client via CDN or bundler -->
<script src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"></script>
<script type="module">
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'

const sock = new SockJS('http://localhost:8081/sockjs', null, {
  // Force HTTP polling for environments without WebSocket
  transports: ['xhr-polling', 'jsonp-polling'],
})

sock.onopen = () => {
  const stream = new WebSocketJSONStream(sock)

  stream.on('data', (msg) => {
    console.log('Message:', msg)
  })

  stream.write({ action: 'subscribe', channel: 'updates' })
}
</script>
*/

// ============================================================
// Transport Fallback Scenarios
// ============================================================
/*
Transport selection depends on:

1. Browser/environment support
2. Server configuration
3. Network conditions (firewalls, proxies)

Priority order (default):
  websocket       - Best performance, full-duplex
  xhr-streaming   - Good for modern browsers behind proxies
  xhr-polling     - Works everywhere, higher latency
  eventsource     - Server-Sent Events based
  htmlfile        - IE-specific streaming
  jsonp-polling   - Legacy, cross-domain without CORS

Example: Force HTTP-only (no WebSocket):
  transports: ['xhr-polling', 'jsonp-polling']

Example: Prefer streaming over polling:
  transports: ['websocket', 'xhr-streaming', 'eventsource', 'xhr-polling']
*/
