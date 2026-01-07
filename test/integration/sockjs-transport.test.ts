/**
 * SockJS Transport Fallback Integration Tests
 *
 * Tests WebSocket to HTTP fallback scenarios using real sockjs server/client.
 * Client uses native sockjs-client API, server uses WebSocketJSONStream.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import sockjs from 'sockjs'
import SockJS from 'sockjs-client'
import { WebSocketJSONStream } from '../../src'

interface TestMessage {
  type: string
  payload: unknown
  transport?: string
}

// Helper to send JSON from client
function clientSend(sock: SockJS.Socket, data: unknown): void {
  sock.send(JSON.stringify(data))
}

// Helper to receive JSON on client
function onClientMessage(sock: SockJS.Socket, callback: (data: unknown) => void): void {
  sock.onmessage = (event) => {
    callback(JSON.parse(event.data))
  }
}

describe('SockJS Transport Fallback', () => {
  let httpServer: http.Server
  let sockjsServer: sockjs.Server
  const PORT = 9876 // Use unique port to avoid conflicts

  beforeAll(async () => {
    // Create SockJS server with all transports enabled
    sockjsServer = sockjs.createServer({
      prefix: '/sockjs',
      log: () => {}, // Suppress logs in tests
    })

    sockjsServer.on('connection', (conn) => {
      if (!conn) return

      const stream = new WebSocketJSONStream<TestMessage>(conn, 'sockjs-node')

      stream.on('data', (data) => {
        // Echo back with transport info
        stream.write({
          type: 'echo',
          payload: data.payload,
          transport: conn.protocol,
        })
      })

      stream.on('error', () => {
        // Ignore errors in test server
      })
    })

    httpServer = http.createServer()
    sockjsServer.installHandlers(httpServer)

    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, resolve)
    })
  }, 15000) // Increase beforeAll timeout

  afterAll(async () => {
    // Force close all connections
    httpServer.closeAllConnections?.()

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve())
      // Force resolve after timeout if close doesn't complete
      setTimeout(resolve, 5000)
    })
  }, 10000)

  describe('WebSocket Transport', () => {
    it('should communicate via WebSocket transport', async () => {
      const sock = new SockJS(`http://localhost:${PORT}/sockjs`, null, {
        transports: ['websocket'],
        timeout: 5000,
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        sock.onopen = () => {
          clearTimeout(timeout)
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }

        sock.onclose = () => {
          // Connection established, now send message
        }

        // Wait for open
        const checkOpen = setInterval(() => {
          if (sock.readyState === SockJS.OPEN) {
            clearInterval(checkOpen)
            clearTimeout(timeout)

            onClientMessage(sock, (data) => {
              const response = data as TestMessage
              expect(response.type).toBe('echo')
              expect(response.payload).toBe('websocket-test')
              expect(response.transport).toBe('websocket')
              sock.close()
              resolve()
            })

            clientSend(sock, { type: 'ping', payload: 'websocket-test' })
          }
        }, 50)
      })
    })
  })

  describe('HTTP Fallback (xhr-polling)', () => {
    it('should fallback to xhr-polling when websocket is disabled', async () => {
      const sock = new SockJS(`http://localhost:${PORT}/sockjs`, null, {
        // Explicitly disable WebSocket, only allow HTTP polling
        transports: ['xhr-polling'],
        timeout: 5000,
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        sock.onopen = () => {
          clearTimeout(timeout)

          onClientMessage(sock, (data) => {
            const response = data as TestMessage
            expect(response.type).toBe('echo')
            expect(response.payload).toBe('polling-test')
            // xhr-polling uses 'xhr-polling' or 'xhr_polling' as protocol
            expect(response.transport).toMatch(/xhr[_-]?polling/i)
            sock.close()
            resolve()
          })

          clientSend(sock, { type: 'ping', payload: 'polling-test' })
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }
      })
    })

    it('should fallback to xhr-streaming when websocket is disabled', async () => {
      const sock = new SockJS(`http://localhost:${PORT}/sockjs`, null, {
        transports: ['xhr-streaming'],
        timeout: 5000,
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        sock.onopen = () => {
          clearTimeout(timeout)

          onClientMessage(sock, (data) => {
            const response = data as TestMessage
            expect(response.type).toBe('echo')
            expect(response.payload).toBe('streaming-test')
            expect(response.transport).toMatch(/xhr[_-]?streaming/i)
            sock.close()
            resolve()
          })

          clientSend(sock, { type: 'ping', payload: 'streaming-test' })
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }
      })
    })
  })

  describe('Transport Selection', () => {
    it('should use only allowed transport when restricted', async () => {
      // Only allow xhr-polling - websocket should NOT be used
      const sock = new SockJS(`http://localhost:${PORT}/sockjs`, null, {
        transports: ['xhr-polling'], // Only HTTP polling allowed
        timeout: 5000,
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)

        sock.onopen = () => {
          clearTimeout(timeout)

          onClientMessage(sock, (data) => {
            const response = data as TestMessage
            // Should use xhr-polling since that's the only allowed transport
            expect(response.transport).toMatch(/xhr[_-]?polling/i)
            expect(response.transport).not.toBe('websocket')
            sock.close()
            resolve()
          })

          clientSend(sock, { type: 'ping', payload: 'restricted-test' })
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }
      })
    })
  })

  describe('Connection Close', () => {
    it('should properly close HTTP fallback connection', async () => {
      const sock = new SockJS(`http://localhost:${PORT}/sockjs`, null, {
        transports: ['xhr-polling'],
        timeout: 10000,
      })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000)

        sock.onopen = () => {
          clearTimeout(timeout)

          const closePromise = new Promise<void>((closeResolve) => {
            sock.onclose = () => closeResolve()
          })

          sock.close()

          // Should close within timeout
          Promise.race([
            closePromise,
            new Promise((_, closeReject) =>
              setTimeout(() => closeReject(new Error('Close timeout')), 10000)
            ),
          ])
            .then(() => resolve())
            .catch(reject)
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }
      })
    }, 20000) // Longer timeout for HTTP polling close
  })
})
