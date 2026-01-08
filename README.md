<div align="center">

# websocket-json-stream

[![license](https://img.shields.io/npm/l/websocket-json-stream?color=blue)](./LICENSE)
[![typescript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

A Node.js Duplex stream wrapper for WebSocket connections with automatic JSON serialization.

Works with Node.js WebSockets (ws), **SockJS**, and **Socket.IO**.

[English](./README.md) | [中文](./README.zh-CN.md)

</div>

---

## Features

- **TypeScript First** - Full type definitions with generic support
- **Dual Package** - ESM and CommonJS support
- **Custom Serializer** - Pluggable serialization (JSON, MessagePack, etc.)
- **SockJS Adapter** - Built-in support for SockJS with HTTP fallback
- **Socket.IO Adapter** - Built-in support for Socket.IO with automatic reconnection
- **Zero Dependencies** - Only peer dependencies for WebSocket libraries
- **Type-Safe Messaging** - Generic types for compile-time message validation

## Installation

```bash
npm install @an-epiphany/websocket-json-stream
# or
pnpm add @an-epiphany/websocket-json-stream
# or
yarn add @an-epiphany/websocket-json-stream
```

## Quick Start

### Server

```typescript
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', (ws) => {
  const stream = new WebSocketJSONStream(ws)

  stream.on('data', (data) => {
    console.log('Received:', data)
    stream.write({ echo: data })
  })
})
```

### Client (Native WebSocket)

```typescript
import { WebSocket } from 'ws'

const ws = new WebSocket('ws://localhost:8080')

ws.on('open', () => {
  ws.send(JSON.stringify({ message: 'Hello!' }))
})

ws.on('message', (data) => {
  const message = JSON.parse(data.toString())
  console.log('Received:', message)
})
```

## Type-Safe Messaging

```typescript
interface ChatMessage {
  type: 'message' | 'join' | 'leave'
  user: string
  content?: string
}

const stream = new WebSocketJSONStream<ChatMessage>(ws)

stream.on('data', (msg) => {
  // msg is typed as ChatMessage
  switch (msg.type) {
    case 'message':
      console.log(`${msg.user}: ${msg.content}`)
      break
    case 'join':
      console.log(`${msg.user} joined`)
      break
  }
})

stream.write({ type: 'message', user: 'Alice', content: 'Hello!' })
```

## Custom Serializer

By default, the stream uses JSON for serialization. You can provide a custom serializer for better performance or different formats.

### Using Options Object

```typescript
import { WebSocketJSONStream, type Serializer } from '@an-epiphany/websocket-json-stream'

// Custom serializer with prefix (example)
const customSerializer: Serializer<MyData> = {
  serialize: (value) => `PREFIX:${JSON.stringify(value)}`,
  deserialize: (data) => JSON.parse(data.replace('PREFIX:', '')),
}

const stream = new WebSocketJSONStream(ws, {
  adapterType: 'ws',
  serializer: customSerializer,
})
```

### MessagePack Example

[MessagePack](https://msgpack.org/) is a binary format that's faster and smaller than JSON.

```typescript
import { WebSocketJSONStream, type Serializer } from '@an-epiphany/websocket-json-stream'
import { encode, decode } from '@msgpack/msgpack'

const msgpackSerializer: Serializer<MyData> = {
  serialize: (value) => Buffer.from(encode(value)).toString('base64'),
  deserialize: (data) => decode(Buffer.from(data, 'base64')) as MyData,
}

const stream = new WebSocketJSONStream(ws, {
  serializer: msgpackSerializer,
})
```

### Base64 Encoding Example

```typescript
const base64Serializer: Serializer<unknown> = {
  serialize: (value) => Buffer.from(JSON.stringify(value)).toString('base64'),
  deserialize: (data) => JSON.parse(Buffer.from(data, 'base64').toString('utf-8')),
}

const stream = new WebSocketJSONStream(ws, {
  serializer: base64Serializer,
})
```

### Default JSON Serializer

You can also import the default serializer for reference or extension:

```typescript
import { jsonSerializer } from '@an-epiphany/websocket-json-stream'

// jsonSerializer.serialize(value) - converts to JSON string
// jsonSerializer.deserialize(data) - parses JSON string
```

## SockJS Support

SockJS provides WebSocket-like API with automatic fallback to HTTP transports when WebSocket is unavailable.

### Server (sockjs-node)

```typescript
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'
import sockjs from 'sockjs'
import http from 'http'

const server = sockjs.createServer()

server.on('connection', (conn) => {
  // Use 'sockjs-node' adapter for server connections
  const stream = new WebSocketJSONStream(conn, 'sockjs-node')

  stream.on('data', (data) => {
    stream.write({ echo: data })
  })
})

const httpServer = http.createServer()
server.installHandlers(httpServer, { prefix: '/sockjs' })
httpServer.listen(8080)
```

### Client (sockjs-client)

```typescript
import SockJS from 'sockjs-client'

const sock = new SockJS('http://localhost:8080/sockjs')

sock.onopen = () => {
  sock.send(JSON.stringify({ message: 'Hello via SockJS!' }))
}

sock.onmessage = (e) => {
  const message = JSON.parse(e.data)
  console.log('Received:', message)
}
```

### Why SockJS?

| Scenario | Solution |
|----------|----------|
| WebSocket blocked by firewall/proxy | Auto-fallback to XHR streaming |
| Corporate networks | Falls back to long-polling |
| Unreliable WebSocket connections | Multiple transport options |

## Socket.IO Support

Socket.IO provides real-time bidirectional event-based communication with automatic reconnection and HTTP fallback.

### Server (socket.io)

```typescript
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'
import { Server as SocketIOServer } from 'socket.io'
import http from 'http'

const httpServer = http.createServer()
const io = new SocketIOServer(httpServer)

io.on('connection', (socket) => {
  // Use 'socketio' adapter for Socket.IO sockets
  const stream = new WebSocketJSONStream(socket, 'socketio')

  stream.on('data', (data) => {
    stream.write({ echo: data })
  })
})

httpServer.listen(8080)
```

### Client (socket.io-client)

```typescript
import { io } from 'socket.io-client'

const socket = io('http://localhost:8080')

socket.on('connect', () => {
  // Send JSON via 'message' event (matches server's WebSocketJSONStream)
  socket.emit('message', JSON.stringify({ message: 'Hello via Socket.IO!' }))
})

socket.on('message', (data: string) => {
  const message = JSON.parse(data)
  console.log('Received:', message)
})
```

### Why Socket.IO?

| Scenario | Solution |
|----------|----------|
| Need automatic reconnection | Built-in reconnection with backoff |
| WebSocket unavailable | Auto-fallback to HTTP long-polling |
| Need room/namespace support | Native rooms and namespaces |
| Cross-browser compatibility | Polyfills and fallbacks included |

## API Reference

### Constructor

```typescript
// New options-based API (recommended)
new WebSocketJSONStream<T>(ws: AdaptableWebSocket, options?: WebSocketJSONStreamOptions<T>)

// Legacy API (still supported)
new WebSocketJSONStream<T>(ws: AdaptableWebSocket, adapterType?: AdapterType)
```

#### Options Object

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `adapterType` | `AdapterType` | `'ws'` | Adapter type for WebSocket implementation |
| `serializer` | `Serializer<T>` | `jsonSerializer` | Custom serializer for encoding/decoding |

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ws` | `AdaptableWebSocket` | - | WebSocket, SockJS, or Socket.IO connection |
| `T` | Generic | `unknown` | Message type |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `data` | `T` | JSON message received |
| `error` | `Error` | Parse/write error |
| `close` | - | Stream closed |
| `finish` | - | Write side ended |

### Methods

| Method | Description |
|--------|-------------|
| `write(data: T)` | Send JSON message |
| `end()` | Close with code 1000 |
| `destroy(error?)` | Force close |

## Closing Connections

```typescript
// Normal close (code: 1000)
stream.end()

// Close without code (code: 1005)
stream.destroy()

// Close with error (code: 1011)
stream.destroy(new Error('Something went wrong'))

// Custom close code (3000-4999)
const error = new Error('Custom') as StreamError
error.closeCode = 4000
error.closeReason = 'Custom reason'
stream.destroy(error)
```

## Error Handling

```typescript
// Handle WebSocket errors (not handled by stream)
ws.on('error', (error) => {
  console.error('WebSocket error:', error)
})

// Handle stream errors
stream.on('error', (error) => {
  console.error('Stream error:', error)
})
```

## Advanced: Adapter Utilities

```typescript
import {
  adaptWebSocket,
  isWebSocketLike,
  isSockJSNodeConnection,
  isSocketIOSocket,
  SockJSNodeAdapter,
  SocketIOAdapter,
} from '@an-epiphany/websocket-json-stream'

// Type checking
if (isSockJSNodeConnection(conn)) {
  console.log('SockJS Node connection')
}

if (isSocketIOSocket(socket)) {
  console.log('Socket.IO socket')
}

// Manual adaptation
const adapted = adaptWebSocket(conn, 'auto')
```

## Types

```typescript
interface Serializer<T = unknown> {
  serialize(value: T): string
  deserialize(data: string): T
}

interface WebSocketJSONStreamOptions<T = unknown> {
  adapterType?: AdapterType
  serializer?: Serializer<T>
}

interface WebSocketLike {
  readonly readyState: number
  send(data: string, callback?: (error?: Error) => void): void
  close(code?: number, reason?: string): void
  addEventListener(type: string, listener: Function): void
  removeEventListener(type: string, listener: Function): void
}

interface SockJSNodeConnection {
  readonly readyState: number
  write(data: string): boolean
  close(code?: number, reason?: string): void
  on(event: 'data' | 'close', listener: Function): this
  off(event: 'data' | 'close', listener: Function): this
}

interface SocketIOSocket {
  readonly id: string
  readonly connected: boolean
  emit(event: string, ...args: unknown[]): this
  on(event: string, listener: Function): this
  off(event: string, listener: Function): this
  disconnect(close?: boolean): this
}

interface StreamError extends Error {
  closeCode?: number
  closeReason?: string
}

type AdaptableWebSocket = WebSocketLike | SockJSNodeConnection | SocketIOSocket
type AdapterType = 'ws' | 'sockjs-node' | 'socketio' | 'auto'
```

## License

[MIT](./LICENSE)

## Credits

TypeScript rewrite of [@teamwork/websocket-json-stream](https://github.com/Teamwork/websocket-json-stream) by Greg Kubisa.
