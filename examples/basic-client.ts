/**
 * Basic WebSocket Client Example
 *
 * A simple client that connects to the basic-server and sends messages.
 *
 * Run: npx tsx examples/basic-client.ts
 */

import { WebSocket } from 'ws'
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'

const URL = 'ws://localhost:8080'

const ws = new WebSocket(URL)
const stream = new WebSocketJSONStream(ws)

ws.on('open', () => {
  console.log('Connected to server')

  // Send a message
  stream.write({ message: 'Hello, server!', from: 'client' })
})

stream.on('data', (data) => {
  console.log('Received:', data)

  // Close after receiving response
  stream.end()
})

stream.on('error', (error) => {
  console.error('Stream error:', error.message)
})

stream.on('close', () => {
  console.log('Connection closed')
  process.exit(0)
})

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message)
})
