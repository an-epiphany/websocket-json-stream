/**
 * CONNECTING State Tests
 *
 * Tests for WebSocket in CONNECTING state (readyState === 0)
 * These require mock WebSocket to simulate the CONNECTING state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebSocketJSONStream, type WebSocketLike } from '../src'

type MessageListener = (event: { data: string }) => void
type OpenCloseListener = () => void

interface MockWebSocket extends WebSocketLike {
  _readyState: number
  _messageListeners: MessageListener[]
  _openListeners: OpenCloseListener[]
  _closeListeners: OpenCloseListener[]
  simulateOpen: () => void
  simulateClose: () => void
  simulateMessage: (data: string) => void
}

function createMockWebSocket(initialState: number = 0): MockWebSocket {
  const messageListeners: MessageListener[] = []
  const openListeners: OpenCloseListener[] = []
  const closeListeners: OpenCloseListener[] = []
  let readyState = initialState

  return {
    get readyState() {
      return readyState
    },
    set _readyState(value: number) {
      readyState = value
    },
    _messageListeners: messageListeners,
    _openListeners: openListeners,
    _closeListeners: closeListeners,
    send: vi.fn((data: string, callback?: (error?: Error) => void) => {
      if (readyState === 1) {
        callback?.()
      } else {
        callback?.(new Error('WebSocket not open'))
      }
    }),
    close: vi.fn((code?: number, reason?: string) => {
      readyState = 2 // CLOSING
      // Simulate async close
      setTimeout(() => {
        readyState = 3 // CLOSED
        for (const listener of [...closeListeners]) {
          listener()
        }
      }, 0)
    }),
    addEventListener: vi.fn((type: string, listener: MessageListener | OpenCloseListener) => {
      if (type === 'message') {
        messageListeners.push(listener as MessageListener)
      } else if (type === 'open') {
        openListeners.push(listener as OpenCloseListener)
      } else if (type === 'close') {
        closeListeners.push(listener as OpenCloseListener)
      }
    }),
    removeEventListener: vi.fn((type: string, listener: MessageListener | OpenCloseListener) => {
      if (type === 'message') {
        const idx = messageListeners.indexOf(listener as MessageListener)
        if (idx >= 0) messageListeners.splice(idx, 1)
      } else if (type === 'open') {
        const idx = openListeners.indexOf(listener as OpenCloseListener)
        if (idx >= 0) openListeners.splice(idx, 1)
      } else if (type === 'close') {
        const idx = closeListeners.indexOf(listener as OpenCloseListener)
        if (idx >= 0) closeListeners.splice(idx, 1)
      }
    }),
    simulateOpen: () => {
      readyState = 1 // OPEN
      for (const listener of [...openListeners]) {
        listener()
      }
    },
    simulateClose: () => {
      readyState = 3 // CLOSED
      for (const listener of [...closeListeners]) {
        listener()
      }
    },
    simulateMessage: (data: string) => {
      for (const listener of [...messageListeners]) {
        listener({ data })
      }
    },
  }
}

describe('CONNECTING State Tests', () => {
  describe('_send queue mechanism', () => {
    it('should queue messages when WebSocket is CONNECTING', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      const callbacks: Array<Error | null | undefined> = []

      // Write multiple messages while CONNECTING
      stream.write({ msg: 1 }, (err) => callbacks.push(err))
      stream.write({ msg: 2 }, (err) => callbacks.push(err))
      stream.write({ msg: 3 }, (err) => callbacks.push(err))

      // Messages should be queued, not sent yet
      expect(mockWs.send).not.toHaveBeenCalled()

      // Simulate WebSocket opening
      mockWs.simulateOpen()

      // Wait for queue processing
      await new Promise((resolve) => setTimeout(resolve, 10))

      // All messages should be sent
      expect(mockWs.send).toHaveBeenCalledTimes(3)
      // Node.js stream callbacks pass null (not undefined) on success
      expect(callbacks.every((cb) => cb === null || cb === undefined)).toBe(true)

      stream.destroy()
    })

    it('should only add one pair of listeners for multiple queued messages', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      // Write multiple messages
      stream.write({ msg: 1 })
      stream.write({ msg: 2 })
      stream.write({ msg: 3 })

      // Should only have added open/close listeners once (plus the initial close listener)
      // Initial: 1 close listener from constructor
      // Queue: 1 open + 1 close listener
      expect(mockWs._openListeners.length).toBe(1)
      expect(mockWs._closeListeners.length).toBe(2) // 1 from constructor + 1 from queue

      stream.destroy()
    })

    it('should process queue when WebSocket closes while CONNECTING', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      const callbacks: Array<Error | null | undefined> = []

      // Write messages while CONNECTING
      stream.write({ msg: 1 }, (err) => callbacks.push(err))
      stream.write({ msg: 2 }, (err) => callbacks.push(err))

      // Simulate WebSocket closing (connection failed)
      mockWs.simulateClose()

      // Wait for queue processing
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Callbacks should be called with errors (WebSocket is closed)
      expect(callbacks.length).toBe(2)
      for (const cb of callbacks) {
        expect(cb).toBeInstanceOf(Error)
      }

      stream.destroy()
    })

    it('should clean up queue listeners after processing', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      stream.write({ msg: 1 })

      const openListenersBefore = mockWs._openListeners.length

      // Simulate open
      mockWs.simulateOpen()

      await new Promise((resolve) => setTimeout(resolve, 10))

      // Queue listeners should be removed
      expect(mockWs._openListeners.length).toBeLessThan(openListenersBefore)

      stream.destroy()
    })
  })

  describe('_destroy with pending queue', () => {
    it('should clean up queue listeners when destroyed in CONNECTING state', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      // Write to create queue
      stream.write({ msg: 1 })

      const openListenersBefore = mockWs._openListeners.length
      const closeListenersBefore = mockWs._closeListeners.length

      // Destroy stream
      stream.destroy()

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Queue listeners should be cleaned up
      // Note: close event will trigger and clean up, so we check they don't accumulate
      expect(mockWs._openListeners.length).toBeLessThanOrEqual(openListenersBefore)
    })

    it('should call all pending queue callbacks with error when destroyed', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      const callbacks: Array<Error | null | undefined> = []

      // Queue multiple messages
      stream.write({ msg: 1 }, (err) => callbacks.push(err))
      stream.write({ msg: 2 }, (err) => callbacks.push(err))
      stream.write({ msg: 3 }, (err) => callbacks.push(err))

      // Destroy immediately
      stream.destroy()

      await new Promise((resolve) => setTimeout(resolve, 50))

      // All callbacks should have been called
      expect(callbacks.length).toBe(3)
      // All should have errors since WebSocket never opened
      for (const cb of callbacks) {
        expect(cb).toBeInstanceOf(Error)
      }
    })
  })

  describe('_closeWebSocket in CONNECTING state', () => {
    it('should handle end() when WebSocket is CONNECTING', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      let closeEmitted = false
      stream.on('close', () => {
        closeEmitted = true
      })

      // Call end() while CONNECTING
      stream.end()

      // Should add listeners for open/close
      expect(mockWs._openListeners.length).toBeGreaterThan(0)

      // Simulate open
      mockWs.simulateOpen()

      // Wait for close sequence
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(closeEmitted).toBe(true)
    })

    it('should handle destroy() when WebSocket is CONNECTING', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      let closeEmitted = false
      stream.on('close', () => {
        closeEmitted = true
      })

      // Destroy while CONNECTING
      stream.destroy()

      // Simulate the WebSocket eventually closing
      mockWs.simulateClose()

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(closeEmitted).toBe(true)
    })

    it('should clean up _closeWsOpenHandler when WebSocket opens then closes', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      // End while CONNECTING
      stream.end()

      // Simulate open
      mockWs.simulateOpen()

      // Wait for close
      await new Promise((resolve) => setTimeout(resolve, 100))

      // All handlers should be cleaned up
      expect(mockWs._openListeners.length).toBe(0)
    })
  })

  describe('Unexpected readyState', () => {
    it('should handle unexpected readyState in _closeWebSocket', async () => {
      const mockWs = createMockWebSocket(1) // Start OPEN
      const stream = new WebSocketJSONStream(mockWs)

      // Manually set to invalid state
      mockWs._readyState = 99

      let errorReceived: Error | null = null
      stream.on('error', (err) => {
        errorReceived = err
      })

      // Try to end - should hit default case
      stream.end()

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Should have received an error about unexpected readyState
      expect(errorReceived).toBeInstanceOf(Error)
      expect(errorReceived?.message).toContain('Unexpected readyState')
    })
  })

  describe('_cleanupCloseWsHandlers', () => {
    it('should clean up both open and close handlers', async () => {
      const mockWs = createMockWebSocket(0) // CONNECTING
      const stream = new WebSocketJSONStream(mockWs)

      // End while CONNECTING - this adds _closeWsOpenHandler and _closeWsCloseHandler
      stream.end()

      expect(mockWs._openListeners.length).toBeGreaterThan(0)
      expect(mockWs._closeListeners.length).toBeGreaterThan(1) // +1 from constructor

      // Destroy to trigger cleanup
      stream.destroy()

      // Simulate close to fully clean up
      mockWs.simulateClose()

      await new Promise((resolve) => setTimeout(resolve, 50))

      // Handlers should be cleaned
      expect(mockWs._openListeners.length).toBe(0)
    })
  })

  describe('Edge cases', () => {
    it('should handle write then immediate destroy in CONNECTING state', async () => {
      const mockWs = createMockWebSocket(0)
      const stream = new WebSocketJSONStream(mockWs)

      const errors: Error[] = []

      // Write and immediately destroy
      stream.write({ msg: 1 }, (err) => {
        if (err) errors.push(err)
      })
      stream.destroy()

      // Simulate close
      mockWs.simulateClose()

      await new Promise((resolve) => setTimeout(resolve, 50))

      // The callback should be called with error
      expect(errors.length).toBe(1)
    })

    it('should handle multiple end() calls in CONNECTING state', async () => {
      const mockWs = createMockWebSocket(0)
      const stream = new WebSocketJSONStream(mockWs)

      // Multiple end calls
      stream.end()
      stream.end()
      stream.end()

      // Simulate open then close
      mockWs.simulateOpen()

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Should not have accumulated listeners
      expect(mockWs._openListeners.length).toBe(0)
    })
  })
})
