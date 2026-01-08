/**
 * Socket.IO Integration Tests
 *
 * Tests WebSocketJSONStream with real Socket.IO server/client.
 * Client uses native socket.io-client API, server uses WebSocketJSONStream.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import { Server as SocketIOServer } from 'socket.io'
import { io as SocketIOClient, Socket as ClientSocket } from 'socket.io-client'
import { WebSocketJSONStream } from '../../src'

interface TestMessage {
  type: string
  payload: unknown
  socketId?: string
}

describe('Socket.IO Transport', () => {
  let httpServer: http.Server
  let ioServer: SocketIOServer
  const PORT = 9877 // Use unique port to avoid conflicts

  beforeAll(async () => {
    httpServer = http.createServer()

    ioServer = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
      },
    })

    ioServer.on('connection', (socket) => {
      const stream = new WebSocketJSONStream<TestMessage>(socket, 'socketio')

      stream.on('data', (data) => {
        // Echo back with socket id
        stream.write({
          type: 'echo',
          payload: data.payload,
          socketId: socket.id,
        })
      })

      stream.on('error', () => {
        // Ignore errors in test server
      })
    })

    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, resolve)
    })
  }, 15000)

  afterAll(async () => {
    // Close all sockets
    ioServer.disconnectSockets(true)

    await new Promise<void>((resolve) => {
      ioServer.close(() => resolve())
    })

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve())
      setTimeout(resolve, 5000)
    })
  }, 10000)

  describe('Basic Communication', () => {
    it('should send and receive JSON messages', async () => {
      const client: ClientSocket = SocketIOClient(`http://localhost:${PORT}`, {
        transports: ['websocket'],
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        client.on('connect', () => {
          clearTimeout(timeout)

          client.on('message', (data: string) => {
            const response: TestMessage = JSON.parse(data)
            expect(response.type).toBe('echo')
            expect(response.payload).toBe('hello-socketio')
            expect(response.socketId).toBe(client.id)
            client.disconnect()
            resolve()
          })

          // Send message using native Socket.IO API
          client.emit('message', JSON.stringify({ type: 'ping', payload: 'hello-socketio' }))
        })

        client.on('connect_error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    })

    it('should handle multiple messages in sequence', async () => {
      const client: ClientSocket = SocketIOClient(`http://localhost:${PORT}`, {
        transports: ['websocket'],
      })

      const messages: TestMessage[] = []

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        client.on('connect', () => {
          clearTimeout(timeout)

          client.on('message', (data: string) => {
            const response: TestMessage = JSON.parse(data)
            messages.push(response)

            if (messages.length === 3) {
              expect(messages[0].payload).toBe('first')
              expect(messages[1].payload).toBe('second')
              expect(messages[2].payload).toBe('third')
              client.disconnect()
              resolve()
            }
          })

          // Send multiple messages
          client.emit('message', JSON.stringify({ type: 'ping', payload: 'first' }))
          client.emit('message', JSON.stringify({ type: 'ping', payload: 'second' }))
          client.emit('message', JSON.stringify({ type: 'ping', payload: 'third' }))
        })

        client.on('connect_error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    })
  })

  describe('Connection Handling', () => {
    it('should handle client disconnect gracefully', async () => {
      const client: ClientSocket = SocketIOClient(`http://localhost:${PORT}`, {
        transports: ['websocket'],
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        client.on('connect', () => {
          clearTimeout(timeout)

          // Disconnect immediately
          client.disconnect()
        })

        client.on('disconnect', () => {
          resolve()
        })

        client.on('connect_error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    })

    it('should handle server-initiated disconnect', async () => {
      const client: ClientSocket = SocketIOClient(`http://localhost:${PORT}`, {
        transports: ['websocket'],
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        client.on('connect', () => {
          clearTimeout(timeout)

          // Server will disconnect all sockets briefly
          const sockets = ioServer.sockets.sockets
          for (const [, socket] of sockets) {
            if (socket.id === client.id) {
              socket.disconnect(true)
            }
          }
        })

        client.on('disconnect', () => {
          resolve()
        })

        client.on('connect_error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    })
  })

  describe('HTTP Polling Fallback', () => {
    it('should work with polling transport', async () => {
      const client: ClientSocket = SocketIOClient(`http://localhost:${PORT}`, {
        transports: ['polling'], // Force polling transport
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)

        client.on('connect', () => {
          clearTimeout(timeout)

          client.on('message', (data: string) => {
            const response: TestMessage = JSON.parse(data)
            expect(response.type).toBe('echo')
            expect(response.payload).toBe('polling-test')
            client.disconnect()
            resolve()
          })

          client.emit('message', JSON.stringify({ type: 'ping', payload: 'polling-test' }))
        })

        client.on('connect_error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    })
  })

  describe('Complex Data Types', () => {
    it('should handle nested objects', async () => {
      const client: ClientSocket = SocketIOClient(`http://localhost:${PORT}`, {
        transports: ['websocket'],
      })

      const complexPayload = {
        user: {
          name: 'Test User',
          age: 30,
          tags: ['admin', 'user'],
        },
        metadata: {
          createdAt: '2024-01-01T00:00:00Z',
          nested: {
            deep: {
              value: 42,
            },
          },
        },
      }

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        client.on('connect', () => {
          clearTimeout(timeout)

          client.on('message', (data: string) => {
            const response: TestMessage = JSON.parse(data)
            expect(response.type).toBe('echo')
            expect(response.payload).toEqual(complexPayload)
            client.disconnect()
            resolve()
          })

          client.emit('message', JSON.stringify({ type: 'ping', payload: complexPayload }))
        })

        client.on('connect_error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    })

    it('should handle arrays', async () => {
      const client: ClientSocket = SocketIOClient(`http://localhost:${PORT}`, {
        transports: ['websocket'],
      })

      const arrayPayload = [1, 2, 3, { a: 'b' }, [4, 5, 6]]

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        client.on('connect', () => {
          clearTimeout(timeout)

          client.on('message', (data: string) => {
            const response: TestMessage = JSON.parse(data)
            expect(response.type).toBe('echo')
            expect(response.payload).toEqual(arrayPayload)
            client.disconnect()
            resolve()
          })

          client.emit('message', JSON.stringify({ type: 'ping', payload: arrayPayload }))
        })

        client.on('connect_error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    })
  })
})
