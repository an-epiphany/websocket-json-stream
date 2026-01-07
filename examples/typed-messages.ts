/**
 * Type-Safe Messaging Example
 *
 * Demonstrates how to use generics for type-safe message handling.
 *
 * Run: npx tsx examples/typed-messages.ts
 */

import { WebSocketServer } from 'ws'
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'

// Define message types
interface ClientMessage {
  type: 'ping' | 'chat' | 'command'
  payload: string
  timestamp?: number
}

interface ServerMessage {
  type: 'pong' | 'chat' | 'result'
  payload: string
  timestamp: number
}

const PORT = 8082
const wss = new WebSocketServer({ port: PORT })

console.log(`Typed message server on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  // Create typed stream
  const stream = new WebSocketJSONStream<ClientMessage>(ws)

  stream.on('data', (msg) => {
    // msg is typed as ClientMessage
    console.log(`[${msg.type}] ${msg.payload}`)

    const response: ServerMessage = {
      type: msg.type === 'ping' ? 'pong' : 'result',
      payload: `Received: ${msg.payload}`,
      timestamp: Date.now(),
    }

    stream.write(response)
  })

  ws.on('error', console.error)
})
