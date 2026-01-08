import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SocketIOAdapter } from '../../src/adapters'
import type { SocketIOSocket } from '../../src/adapters'

function createMockSocketIOSocket(): SocketIOSocket & {
  _messageListeners: ((data: string) => void)[]
  _disconnectListeners: ((reason: string) => void)[]
  _connected: boolean
  simulateMessage: (data: string) => void
  simulateDisconnect: (reason?: string) => void
  setConnected: (connected: boolean) => void
} {
  const messageListeners: ((data: string) => void)[] = []
  const disconnectListeners: ((reason: string) => void)[] = []
  let connected = true

  const mockSocket = {
    id: 'test-socket-id',
    get connected() {
      return connected
    },
    _messageListeners: messageListeners,
    _disconnectListeners: disconnectListeners,
    _connected: connected,
    emit: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (event === 'message') {
        messageListeners.push(listener as (data: string) => void)
      } else if (event === 'disconnect') {
        disconnectListeners.push(listener as (reason: string) => void)
      }
      return mockSocket
    }),
    off: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (event === 'message') {
        const idx = messageListeners.indexOf(listener as (data: string) => void)
        if (idx >= 0) messageListeners.splice(idx, 1)
      } else if (event === 'disconnect') {
        const idx = disconnectListeners.indexOf(listener as (reason: string) => void)
        if (idx >= 0) disconnectListeners.splice(idx, 1)
      }
      return mockSocket
    }),
    disconnect: vi.fn().mockReturnThis(),
    simulateMessage: (data: string) => {
      for (const listener of messageListeners) {
        listener(data)
      }
    },
    simulateDisconnect: (reason = 'io client disconnect') => {
      for (const listener of disconnectListeners) {
        listener(reason)
      }
    },
    setConnected: (value: boolean) => {
      connected = value
    },
  }

  return mockSocket
}

describe('SocketIOAdapter', () => {
  let mockSocket: ReturnType<typeof createMockSocketIOSocket>
  let adapter: SocketIOAdapter

  beforeEach(() => {
    mockSocket = createMockSocketIOSocket()
    adapter = new SocketIOAdapter(mockSocket)
  })

  describe('readyState', () => {
    it('should return 1 (OPEN) when socket is connected', () => {
      expect(adapter.readyState).toBe(1)
    })

    it('should return 3 (CLOSED) when socket is disconnected', () => {
      mockSocket.setConnected(false)
      expect(adapter.readyState).toBe(3)
    })
  })

  describe('send', () => {
    it('should call emit("message", data) on the socket', () => {
      adapter.send('test data')
      expect(mockSocket.emit).toHaveBeenCalledWith('message', 'test data')
    })

    it('should call callback on success', () => {
      const callback = vi.fn()
      adapter.send('test data', callback)
      expect(callback).toHaveBeenCalledWith()
    })

    it('should call callback with error on failure', () => {
      const error = new Error('Emit failed')
      mockSocket.emit = vi.fn(() => {
        throw error
      })
      const callback = vi.fn()

      adapter.send('test data', callback)

      expect(callback).toHaveBeenCalledWith(error)
    })
  })

  describe('close', () => {
    it('should call disconnect(true) on the socket', () => {
      adapter.close()
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true)
    })

    it('should ignore close code and reason (Socket.IO does not support them)', () => {
      adapter.close(1000, 'Normal closure')
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true)
    })
  })

  describe('addEventListener', () => {
    it('should convert message listener to socket.on("message")', () => {
      const listener = vi.fn()
      adapter.addEventListener('message', listener)

      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should wrap data in event object for message listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('message', listener)

      mockSocket.simulateMessage('{"test": 1}')

      expect(listener).toHaveBeenCalledWith({ data: '{"test": 1}' })
    })

    it('should register disconnect listener for close event', () => {
      const listener = vi.fn()
      adapter.addEventListener('close', listener)

      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    })

    it('should call close listener on disconnect event', () => {
      const listener = vi.fn()
      adapter.addEventListener('close', listener)

      mockSocket.simulateDisconnect('io client disconnect')

      expect(listener).toHaveBeenCalled()
    })

    it('should ignore open event (Socket.IO sockets are already connected)', () => {
      const listener = vi.fn()
      adapter.addEventListener('open', listener)

      // on() should not be called for 'open' event
      expect(mockSocket.on).not.toHaveBeenCalledWith('connect', expect.any(Function))
    })
  })

  describe('removeEventListener', () => {
    it('should remove message listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('message', listener)

      adapter.removeEventListener('message', listener)

      expect(mockSocket.off).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('should stop receiving data after removing message listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('message', listener)
      adapter.removeEventListener('message', listener)

      mockSocket.simulateMessage('{"test": 1}')

      expect(listener).not.toHaveBeenCalled()
    })

    it('should remove close listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('close', listener)

      adapter.removeEventListener('close', listener)

      expect(mockSocket.off).toHaveBeenCalledWith('disconnect', expect.any(Function))
    })

    it('should stop receiving disconnect after removing close listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('close', listener)
      adapter.removeEventListener('close', listener)

      mockSocket.simulateDisconnect()

      expect(listener).not.toHaveBeenCalled()
    })

    it('should do nothing when removing non-existent listener', () => {
      const listener = vi.fn()

      // Should not throw
      adapter.removeEventListener('message', listener)
      adapter.removeEventListener('close', listener)

      expect(mockSocket.off).not.toHaveBeenCalled()
    })
  })

  describe('multiple listeners', () => {
    it('should support multiple message listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      adapter.addEventListener('message', listener1)
      adapter.addEventListener('message', listener2)

      mockSocket.simulateMessage('test')

      expect(listener1).toHaveBeenCalledWith({ data: 'test' })
      expect(listener2).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should only remove the specific listener', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      adapter.addEventListener('message', listener1)
      adapter.addEventListener('message', listener2)

      adapter.removeEventListener('message', listener1)

      mockSocket.simulateMessage('test')

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).toHaveBeenCalledWith({ data: 'test' })
    })
  })

  describe('resource cleanup', () => {
    it('should clear internal maps after clearAllListeners()', () => {
      const messageListener = vi.fn()
      const closeListener = vi.fn()

      adapter.addEventListener('message', messageListener)
      adapter.addEventListener('close', closeListener)

      // Clear all listeners
      adapter.clearAllListeners()

      // Listeners should no longer be called
      mockSocket.simulateMessage('test')
      mockSocket.simulateDisconnect()

      expect(messageListener).not.toHaveBeenCalled()
      expect(closeListener).not.toHaveBeenCalled()
    })

    it('should not leak memory when adding and removing many listeners', () => {
      const listeners: Array<() => void> = []

      // Add many listeners
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn()
        listeners.push(listener)
        adapter.addEventListener('message', listener)
      }

      // Remove all listeners
      for (const listener of listeners) {
        adapter.removeEventListener('message', listener)
      }

      // Internal map should be empty (we can verify by the fact that
      // no listeners are called when data is received)
      mockSocket.simulateMessage('test')

      for (const listener of listeners) {
        expect(listener).not.toHaveBeenCalled()
      }
    })

    it('should clean up when connection disconnects', () => {
      const messageListener = vi.fn()
      const closeListener = vi.fn()

      adapter.addEventListener('message', messageListener)
      adapter.addEventListener('close', closeListener)

      // Simulate connection disconnect
      mockSocket.simulateDisconnect()

      // Verify the close listener was called
      expect(closeListener).toHaveBeenCalled()
    })
  })
})
