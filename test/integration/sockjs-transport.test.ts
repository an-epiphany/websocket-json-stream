/**
 * SockJS Transport Fallback Integration Tests
 *
 * Tests WebSocket to HTTP fallback scenarios using real sockjs server/client.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import http from 'node:http'
import sockjs from 'sockjs'
import SockJS from 'sockjs-client'
import { WebSocketJSONStream } from '../../src'

interface TestMessage {
  type: string
  payload: unknown
  transport?: string
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

      const stream = await new Promise<WebSocketJSONStream<TestMessage>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        sock.onopen = () => {
          clearTimeout(timeout)
          resolve(new WebSocketJSONStream<TestMessage>(sock))
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }
      })

      const response = await new Promise<TestMessage>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 5000)

        stream.on('data', (data) => {
          clearTimeout(timeout)
          resolve(data)
        })

        stream.write({ type: 'ping', payload: 'websocket-test' })
      })

      expect(response.type).toBe('echo')
      expect(response.payload).toBe('websocket-test')
      expect(response.transport).toBe('websocket')

      stream.end()
    })
  })

  describe('HTTP Fallback (xhr-polling)', () => {
    it('should fallback to xhr-polling when websocket is disabled', async () => {
      const sock = new SockJS(`http://localhost:${PORT}/sockjs`, null, {
        // Explicitly disable WebSocket, only allow HTTP polling
        transports: ['xhr-polling'],
        timeout: 5000,
      })

      const stream = await new Promise<WebSocketJSONStream<TestMessage>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        sock.onopen = () => {
          clearTimeout(timeout)
          resolve(new WebSocketJSONStream<TestMessage>(sock))
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }
      })

      const response = await new Promise<TestMessage>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 5000)

        stream.on('data', (data) => {
          clearTimeout(timeout)
          resolve(data)
        })

        stream.write({ type: 'ping', payload: 'polling-test' })
      })

      expect(response.type).toBe('echo')
      expect(response.payload).toBe('polling-test')
      // xhr-polling uses 'xhr-polling' or 'xhr_polling' as protocol
      expect(response.transport).toMatch(/xhr[_-]?polling/i)

      stream.end()
    })

    it('should fallback to xhr-streaming when websocket is disabled', async () => {
      const sock = new SockJS(`http://localhost:${PORT}/sockjs`, null, {
        transports: ['xhr-streaming'],
        timeout: 5000,
      })

      const stream = await new Promise<WebSocketJSONStream<TestMessage>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000)

        sock.onopen = () => {
          clearTimeout(timeout)
          resolve(new WebSocketJSONStream<TestMessage>(sock))
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }
      })

      const response = await new Promise<TestMessage>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 5000)

        stream.on('data', (data) => {
          clearTimeout(timeout)
          resolve(data)
        })

        stream.write({ type: 'ping', payload: 'streaming-test' })
      })

      expect(response.type).toBe('echo')
      expect(response.payload).toBe('streaming-test')
      expect(response.transport).toMatch(/xhr[_-]?streaming/i)

      stream.end()
    })
  })

  describe('Transport Selection', () => {
    it('should use only allowed transport when restricted', async () => {
      // Only allow xhr-polling - websocket should NOT be used
      const sock = new SockJS(`http://localhost:${PORT}/sockjs`, null, {
        transports: ['xhr-polling'], // Only HTTP polling allowed
        timeout: 5000,
      })

      const stream = await new Promise<WebSocketJSONStream<TestMessage>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000)

        sock.onopen = () => {
          clearTimeout(timeout)
          resolve(new WebSocketJSONStream<TestMessage>(sock))
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }
      })

      const response = await new Promise<TestMessage>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Response timeout')), 10000)

        stream.on('data', (data) => {
          clearTimeout(timeout)
          resolve(data)
        })

        stream.write({ type: 'ping', payload: 'restricted-test' })
      })

      // Should use xhr-polling since that's the only allowed transport
      expect(response.transport).toMatch(/xhr[_-]?polling/i)
      expect(response.transport).not.toBe('websocket')

      stream.end()
    })
  })

  describe('Connection Close', () => {
    it('should properly close HTTP fallback connection', async () => {
      const sock = new SockJS(`http://localhost:${PORT}/sockjs`, null, {
        transports: ['xhr-polling'],
        timeout: 10000,
      })

      const stream = await new Promise<WebSocketJSONStream<TestMessage>>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000)

        sock.onopen = () => {
          clearTimeout(timeout)
          resolve(new WebSocketJSONStream<TestMessage>(sock))
        }

        sock.onerror = (err) => {
          clearTimeout(timeout)
          reject(err)
        }
      })

      const closePromise = new Promise<void>((resolve) => {
        stream.on('close', resolve)
      })

      stream.end()

      // Should close within timeout
      await expect(
        Promise.race([
          closePromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Close timeout')), 10000)
          ),
        ])
      ).resolves.toBeUndefined()
    }, 20000) // Longer timeout for HTTP polling close
  })
})
