/**
 * Basic WebSocket Server Example
 *
 * A simple echo server that demonstrates WebSocketJSONStream usage
 * with the standard ws library.
 *
 * Run: npx tsx examples/basic-server.ts
 */

import { WebSocketServer } from 'ws'
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'

const PORT = 8080

const wss = new WebSocketServer({ port: PORT })

console.log(`WebSocket server listening on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  console.log('Client connected')

  const stream = new WebSocketJSONStream(ws)

  // Handle incoming messages
  stream.on('data', (data) => {
    console.log('Received:', data)

    // Echo back with timestamp
    stream.write({
      echo: data,
      timestamp: Date.now(),
    })
  })

  // Handle errors
  stream.on('error', (error) => {
    console.error('Stream error:', error.message)
  })

  // Handle close
  stream.on('close', () => {
    console.log('Client disconnected')
  })

  // Handle WebSocket errors separately
  ws.on('error', (error) => {
    console.error('WebSocket error:', error.message)
  })
})
