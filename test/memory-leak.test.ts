/**
 * Memory Leak and Resource Cleanup Tests
 *
 * Tests to ensure proper cleanup of event listeners and resources
 * to prevent memory leaks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer, type Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { WebSocketJSONStream } from '../src'

interface TestContext {
  httpServer: Server
  wsServer: WebSocketServer
  url: string
}

describe('Memory Leak Prevention', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = {} as TestContext
    ctx.httpServer = createServer()
    ctx.wsServer = new WebSocketServer({ server: ctx.httpServer })

    await new Promise<void>((resolve) => {
      ctx.httpServer.listen(() => {
        const address = ctx.httpServer.address()
        if (typeof address === 'object' && address) {
          ctx.url = `http://[${address.address}]:${address.port}`
        }
        resolve()
      })
    })
  })

  afterEach(async () => {
    ctx.wsServer.close()
    await new Promise<void>((resolve) => ctx.httpServer.close(() => resolve()))
  })

  describe('Event Listener Cleanup', () => {
    it('should remove message listener after stream.destroy()', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      const stream = new WebSocketJSONStream(serverWs)

      // Get initial listener count
      const initialListenerCount = serverWs.listenerCount('message')

      // Destroy the stream
      await new Promise<void>((resolve) => {
        stream.on('close', resolve)
        stream.destroy()
      })

      // After destroy, message listeners should be removed
      const finalListenerCount = serverWs.listenerCount('message')

      // The stream should have cleaned up its message listener
      expect(finalListenerCount).toBeLessThan(initialListenerCount)

      clientWs.terminate()
    })

    it('should remove close listener after stream.destroy()', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      const stream = new WebSocketJSONStream(serverWs)

      // Get initial listener count
      const initialListenerCount = serverWs.listenerCount('close')

      // Destroy the stream
      await new Promise<void>((resolve) => {
        stream.on('close', resolve)
        stream.destroy()
      })

      // After destroy, close listeners should be removed
      const finalListenerCount = serverWs.listenerCount('close')

      // The stream should have cleaned up its close listener
      expect(finalListenerCount).toBeLessThan(initialListenerCount)

      clientWs.terminate()
    })

    it('should remove all listeners after stream.end()', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      const stream = new WebSocketJSONStream(serverWs)

      // Get initial listener counts
      const initialMessageCount = serverWs.listenerCount('message')
      const initialCloseCount = serverWs.listenerCount('close')

      // End the stream gracefully
      await new Promise<void>((resolve) => {
        stream.on('close', resolve)
        stream.end()
      })

      // After end, listeners should be removed
      const finalMessageCount = serverWs.listenerCount('message')
      const finalCloseCount = serverWs.listenerCount('close')

      expect(finalMessageCount).toBeLessThan(initialMessageCount)
      expect(finalCloseCount).toBeLessThan(initialCloseCount)

      clientWs.terminate()
    })

    it('should not leak listeners when creating and destroying multiple streams', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      // Record initial listener count (ws library may have its own listeners)
      const initialMessageListeners = serverWs.listenerCount('message')
      const initialCloseListeners = serverWs.listenerCount('close')

      // Create and destroy multiple streams
      for (let i = 0; i < 5; i++) {
        const stream = new WebSocketJSONStream(serverWs)

        await new Promise<void>((resolve) => {
          stream.on('close', resolve)
          stream.destroy()
        })
      }

      // After all streams are destroyed, listener count should return to initial
      const finalMessageListeners = serverWs.listenerCount('message')
      const finalCloseListeners = serverWs.listenerCount('close')

      // Should not have accumulated listeners from destroyed streams
      expect(finalMessageListeners).toBe(initialMessageListeners)
      expect(finalCloseListeners).toBe(initialCloseListeners)

      clientWs.terminate()
    })
  })

  describe('Pending Queue Cleanup', () => {
    it('should clean up pending queue when stream is destroyed', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      const stream = new WebSocketJSONStream(serverWs)

      // Destroy stream while it's open - should trigger cleanup
      stream.on('close', () => {
        // Stream is closed
      })

      // Write some data then immediately destroy
      const errors: Error[] = []
      stream.write({ test: 1 }, (err) => {
        if (err) errors.push(err)
      })

      stream.destroy()

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100))

      // The write should have completed or errored - no memory leak
      clientWs.terminate()
    })

    it('should call all pending queue callbacks with error when destroyed', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      const stream = new WebSocketJSONStream(serverWs)
      const callbackResults: Array<Error | null | undefined> = []

      // Write multiple messages
      for (let i = 0; i < 5; i++) {
        stream.write({ index: i }, (err) => {
          callbackResults.push(err)
        })
      }

      // Destroy immediately
      await new Promise<void>((resolve) => {
        stream.on('close', resolve)
        stream.destroy()
      })

      // All callbacks should have been called
      // Some may succeed (if WebSocket was open), some may fail (after destroy)
      expect(callbackResults.length).toBe(5)

      clientWs.terminate()
    })

    it('should not leak listeners when rapidly creating and destroying streams', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      const initialMessageListeners = serverWs.listenerCount('message')
      const initialCloseListeners = serverWs.listenerCount('close')
      const initialOpenListeners = serverWs.listenerCount('open')

      // Create and destroy streams rapidly
      for (let i = 0; i < 10; i++) {
        const stream = new WebSocketJSONStream(serverWs)

        // Write something
        stream.write({ index: i }, () => {})

        // Immediately destroy
        await new Promise<void>((resolve) => {
          stream.on('close', resolve)
          stream.destroy()
        })
      }

      // Check listener counts haven't accumulated
      expect(serverWs.listenerCount('message')).toBe(initialMessageListeners)
      expect(serverWs.listenerCount('close')).toBe(initialCloseListeners)
      expect(serverWs.listenerCount('open')).toBe(initialOpenListeners)

      clientWs.terminate()
    })
  })

  describe('_closeWebSocket Handler Cleanup', () => {
    it('should clean up handlers when destroyed during CLOSING state', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      const initialCloseListeners = serverWs.listenerCount('close')

      const stream = new WebSocketJSONStream(serverWs)

      // Start closing the WebSocket (enters CLOSING state)
      serverWs.close()

      // Immediately destroy the stream while WebSocket is closing
      await new Promise<void>((resolve) => {
        stream.on('close', resolve)
        stream.destroy()
      })

      // Wait for WebSocket to fully close
      await new Promise<void>((resolve) => {
        if (serverWs.readyState === WebSocket.CLOSED) {
          resolve()
        } else {
          serverWs.once('close', () => resolve())
        }
      })

      // Check no listeners leaked
      expect(serverWs.listenerCount('close')).toBe(initialCloseListeners)

      clientWs.terminate()
    })

    it('should clean up handlers when stream.end() is called multiple times', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      const initialCloseListeners = serverWs.listenerCount('close')

      const stream = new WebSocketJSONStream(serverWs)

      // Call end() multiple times rapidly
      stream.end()
      stream.end()
      stream.end()

      // Wait for stream to close
      await new Promise<void>((resolve) => {
        stream.on('close', resolve)
      })

      // Wait a bit for any async cleanup
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Check no listeners leaked
      expect(serverWs.listenerCount('close')).toBe(initialCloseListeners)

      clientWs.terminate()
    })

    it('should clean up handlers when destroy() is called after end()', async () => {
      const clientWs = new WebSocket(ctx.url)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      await new Promise<void>((resolve) => {
        clientWs.once('open', resolve)
      })

      const initialCloseListeners = serverWs.listenerCount('close')
      const initialOpenListeners = serverWs.listenerCount('open')

      const stream = new WebSocketJSONStream(serverWs)

      // Call end() then immediately destroy()
      stream.end()
      stream.destroy()

      // Wait for stream to close
      await new Promise<void>((resolve) => {
        stream.on('close', resolve)
      })

      // Wait for WebSocket to fully close
      await new Promise<void>((resolve) => {
        if (serverWs.readyState === WebSocket.CLOSED) {
          resolve()
        } else {
          serverWs.once('close', () => resolve())
        }
      })

      // Check no listeners leaked
      expect(serverWs.listenerCount('close')).toBe(initialCloseListeners)
      expect(serverWs.listenerCount('open')).toBe(initialOpenListeners)

      clientWs.terminate()
    })

    it('should not leak listeners when destroying stream in various states', async () => {
      // Test destroying in OPEN state
      {
        const clientWs = new WebSocket(ctx.url)
        const serverWs = await new Promise<WebSocket>((resolve) => {
          ctx.wsServer.once('connection', resolve)
        })
        await new Promise<void>((resolve) => {
          clientWs.once('open', resolve)
        })

        const initialClose = serverWs.listenerCount('close')
        const initialOpen = serverWs.listenerCount('open')

        const stream = new WebSocketJSONStream(serverWs)
        await new Promise<void>((resolve) => {
          stream.on('close', resolve)
          stream.destroy()
        })

        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(serverWs.listenerCount('close')).toBe(initialClose)
        expect(serverWs.listenerCount('open')).toBe(initialOpen)

        clientWs.terminate()
      }

      // Test destroying with error
      {
        const clientWs = new WebSocket(ctx.url)
        const serverWs = await new Promise<WebSocket>((resolve) => {
          ctx.wsServer.once('connection', resolve)
        })
        await new Promise<void>((resolve) => {
          clientWs.once('open', resolve)
        })

        const initialClose = serverWs.listenerCount('close')
        const initialOpen = serverWs.listenerCount('open')

        const stream = new WebSocketJSONStream(serverWs)
        stream.on('error', () => {}) // Suppress error event

        await new Promise<void>((resolve) => {
          stream.on('close', resolve)
          stream.destroy(new Error('Test error'))
        })

        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(serverWs.listenerCount('close')).toBe(initialClose)
        expect(serverWs.listenerCount('open')).toBe(initialOpen)

        clientWs.terminate()
      }
    })
  })
})
