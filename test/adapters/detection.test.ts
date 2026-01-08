import { describe, it, expect, vi } from 'vitest'
import { isWebSocketLike, isSockJSNodeConnection, isSocketIOSocket, adaptWebSocket, SockJSNodeAdapter, SocketIOAdapter } from '../../src/adapters'

describe('Type Detection', () => {
  describe('isWebSocketLike', () => {
    it('should return true for standard WebSocket-like object', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      expect(isWebSocketLike(mockWs)).toBe(true)
    })

    it('should return false for sockjs-node style connection', () => {
      const mockConn = {
        readyState: 1,
        write: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      }
      expect(isWebSocketLike(mockConn)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isWebSocketLike(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isWebSocketLike(undefined)).toBe(false)
    })

    it('should return false for non-object', () => {
      expect(isWebSocketLike('string')).toBe(false)
      expect(isWebSocketLike(123)).toBe(false)
    })

    it('should return false for object missing required methods', () => {
      const incomplete = {
        readyState: 1,
        send: vi.fn(),
        // missing close, addEventListener, removeEventListener
      }
      expect(isWebSocketLike(incomplete)).toBe(false)
    })
  })

  describe('isSockJSNodeConnection', () => {
    it('should return true for sockjs-node style connection', () => {
      const mockConn = {
        readyState: 1,
        write: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      }
      expect(isSockJSNodeConnection(mockConn)).toBe(true)
    })

    it('should return false for standard WebSocket-like object', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      expect(isSockJSNodeConnection(mockWs)).toBe(false)
    })

    it('should return false for object with both send and write', () => {
      const hybrid = {
        readyState: 1,
        write: vi.fn(),
        send: vi.fn(), // Has send, so not sockjs-node
        close: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      }
      expect(isSockJSNodeConnection(hybrid)).toBe(false)
    })

    it('should return false for Socket.IO socket', () => {
      const mockSocket = {
        id: 'test-id',
        connected: true,
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        disconnect: vi.fn(),
      }
      expect(isSockJSNodeConnection(mockSocket)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isSockJSNodeConnection(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isSockJSNodeConnection(undefined)).toBe(false)
    })
  })

  describe('isSocketIOSocket', () => {
    it('should return true for Socket.IO socket', () => {
      const mockSocket = {
        id: 'test-id',
        connected: true,
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        disconnect: vi.fn(),
      }
      expect(isSocketIOSocket(mockSocket)).toBe(true)
    })

    it('should return false for standard WebSocket-like object', () => {
      const mockWs = {
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
      expect(isSocketIOSocket(mockWs)).toBe(false)
    })

    it('should return false for sockjs-node connection', () => {
      const mockConn = {
        readyState: 1,
        write: vi.fn(),
        close: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      }
      expect(isSocketIOSocket(mockConn)).toBe(false)
    })

    it('should return false for object with readyState (like WebSocket)', () => {
      const hybrid = {
        id: 'test-id',
        connected: true,
        readyState: 1, // Has readyState, so not Socket.IO
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        disconnect: vi.fn(),
      }
      expect(isSocketIOSocket(hybrid)).toBe(false)
    })

    it('should return false for object with send method', () => {
      const hybrid = {
        id: 'test-id',
        connected: true,
        send: vi.fn(), // Has send, so not Socket.IO
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        disconnect: vi.fn(),
      }
      expect(isSocketIOSocket(hybrid)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isSocketIOSocket(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(isSocketIOSocket(undefined)).toBe(false)
    })

    it('should return false for non-object', () => {
      expect(isSocketIOSocket('string')).toBe(false)
      expect(isSocketIOSocket(123)).toBe(false)
    })

    it('should return false for object missing required properties', () => {
      const incomplete = {
        id: 'test-id',
        emit: vi.fn(),
        // missing connected, on, off, disconnect
      }
      expect(isSocketIOSocket(incomplete)).toBe(false)
    })
  })

  describe('adaptWebSocket', () => {
    const mockWs = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }

    const mockConn = {
      readyState: 1,
      write: vi.fn(),
      close: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      removeListener: vi.fn(),
    }

    const mockSocket = {
      id: 'test-id',
      connected: true,
      emit: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
    }

    describe('with adapterType="ws" (default)', () => {
      it('should return the same object without adaptation', () => {
        const result = adaptWebSocket(mockWs)
        expect(result).toBe(mockWs)
      })

      it('should return the same object even for sockjs-node connection', () => {
        // When explicitly using 'ws', no adaptation is done
        const result = adaptWebSocket(mockConn as never)
        expect(result).toBe(mockConn)
      })
    })

    describe('with adapterType="sockjs-node"', () => {
      it('should return SockJSNodeAdapter', () => {
        const result = adaptWebSocket(mockConn as never, 'sockjs-node')
        expect(result).toBeInstanceOf(SockJSNodeAdapter)
      })
    })

    describe('with adapterType="socketio"', () => {
      it('should return SocketIOAdapter', () => {
        const result = adaptWebSocket(mockSocket as never, 'socketio')
        expect(result).toBeInstanceOf(SocketIOAdapter)
      })
    })

    describe('with adapterType="auto"', () => {
      it('should return the same object for WebSocket-like', () => {
        const result = adaptWebSocket(mockWs, 'auto')
        expect(result).toBe(mockWs)
      })

      it('should return SockJSNodeAdapter for sockjs-node connection', () => {
        const result = adaptWebSocket(mockConn, 'auto')
        expect(result).toBeInstanceOf(SockJSNodeAdapter)
      })

      it('should return SocketIOAdapter for Socket.IO socket', () => {
        const result = adaptWebSocket(mockSocket, 'auto')
        expect(result).toBeInstanceOf(SocketIOAdapter)
      })

      it('should throw for unsupported object type', () => {
        const unsupported = {
          readyState: 1,
          // Missing required methods for all types
        }
        expect(() => adaptWebSocket(unsupported as never, 'auto')).toThrow('Unsupported WebSocket type')
      })

      it('should throw for unknown adapter type', () => {
        const mockWs = {
          readyState: 1,
          send: vi.fn(),
          close: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }
        expect(() => adaptWebSocket(mockWs, 'unknown' as never)).toThrow('Unknown adapter type')
      })
    })
  })
})
