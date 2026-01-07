# Examples

Best practice examples for `websocket-json-stream`.

> **Note:** This package is designed for **server-side use only**. Clients should use native WebSocket or SockJS APIs directly with `JSON.stringify()`/`JSON.parse()`.

## Quick Start

```bash
# Enter examples directory
cd examples

# Install dependencies
pnpm install

# Build parent package first (required for link)
cd .. && pnpm build && cd examples
```

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Basic Server | `pnpm basic:server` | WebSocket echo server (uses WebSocketJSONStream) |
| Basic Client | `pnpm basic:client` | WebSocket client (uses native ws API) |
| SockJS Server | `pnpm sockjs:server` | SockJS server with HTTP fallback |
| SockJS Client | `pnpm sockjs:client` | SockJS client (uses native sockjs-client API) |
| Typed Messages | `pnpm typed` | Type-safe messaging demo |

## Basic Usage

Terminal 1:
```bash
pnpm basic:server
```

Terminal 2:
```bash
pnpm basic:client
```

## SockJS (with HTTP fallback)

Terminal 1:
```bash
pnpm sockjs:server
```

Terminal 2:
```bash
pnpm sockjs:client
```

### Server Configuration

```typescript
sockjs.createServer({
  prefix: '/sockjs',
  sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js',
  heartbeat_delay: 25000,
  disconnect_delay: 5000,
  response_limit: 128 * 1024,
  // websocket: false,  // Disable WebSocket to force HTTP fallback
})
```

### Client Configuration

```typescript
new SockJS(url, null, {
  transports: ['websocket', 'xhr-streaming', 'xhr-polling'],
  timeout: 5000,
})
```

### Transport Options

| Transport | Description | Use Case |
|-----------|-------------|----------|
| `websocket` | Full-duplex, best performance | Default |
| `xhr-streaming` | HTTP streaming | Behind proxies |
| `xhr-polling` | HTTP long-polling | Universal fallback |
| `eventsource` | Server-Sent Events | One-way streaming |
| `jsonp-polling` | JSONP-based | Legacy cross-domain |

### Fallback Examples

```typescript
// Force HTTP-only (no WebSocket)
transports: ['xhr-polling', 'jsonp-polling']

// Maximum compatibility
transports: ['websocket', 'xhr-streaming', 'xhr-polling', 'jsonp-polling']
```

## Best Practices

### 1. Always Handle Errors

```typescript
// Server-side (with WebSocketJSONStream)
stream.on('error', (error) => {
  console.error('Stream error:', error.message)
})

// Client-side (native WebSocket)
ws.on('error', (error) => {
  console.error('WebSocket error:', error.message)
})
```

### 2. Server Uses WebSocketJSONStream, Client Uses Native API

```typescript
// Server (sockjs-node) - use WebSocketJSONStream
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'

server.on('connection', (conn) => {
  const stream = new WebSocketJSONStream(conn, 'sockjs-node')
  stream.on('data', (msg) => {
    stream.write({ echo: msg })
  })
})

// Client (sockjs-client) - use native API
const sock = new SockJS('http://localhost:8081/sockjs')
sock.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  console.log('Received:', msg)
}
sock.send(JSON.stringify({ hello: 'world' }))
```

### 3. Use TypeScript Generics (Server-Side)

```typescript
interface MyMessage {
  type: string
  payload: unknown
}

const stream = new WebSocketJSONStream<MyMessage>(ws)

stream.on('data', (msg) => {
  console.log(msg.type)  // typed!
})
```

### 4. Graceful Shutdown

```typescript
// Normal closure
stream.end()

// With error
stream.destroy(new Error('Something went wrong'))
```
