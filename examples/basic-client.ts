/**
 * Basic WebSocket Client Example
 *
 * A simple client that connects to the basic-server and sends messages.
 * Uses native ws API - no WebSocketJSONStream needed on client side.
 *
 * Run: npx tsx examples/basic-client.ts
 */

import { WebSocket } from 'ws'

const URL = 'ws://localhost:8080'

const ws = new WebSocket(URL)

ws.on('open', () => {
  console.log('Connected to server')

  // Send JSON message directly
  ws.send(JSON.stringify({ message: 'Hello, server!', from: 'client' }))
})

ws.on('message', (data) => {
  const message = JSON.parse(data.toString())
  console.log('Received:', message)

  // Close after receiving response
  ws.close(1000, 'done')
})

ws.on('close', () => {
  console.log('Connection closed')
  process.exit(0)
})

ws.on('error', (error) => {
  console.error('WebSocket error:', error.message)
})
