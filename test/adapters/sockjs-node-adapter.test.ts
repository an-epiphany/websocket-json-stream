import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SockJSNodeAdapter } from '../../src/adapters'
import type { SockJSNodeConnection } from '../../src/adapters'

function createMockSockJSConnection(): SockJSNodeConnection & {
  _dataListeners: ((data: string) => void)[]
  _closeListeners: (() => void)[]
  simulateData: (data: string) => void
  simulateClose: () => void
} {
  const dataListeners: ((data: string) => void)[] = []
  const closeListeners: (() => void)[] = []

  return {
    readyState: 1,
    _dataListeners: dataListeners,
    _closeListeners: closeListeners,
    write: vi.fn().mockReturnValue(true),
    close: vi.fn(),
    end: vi.fn(),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (event === 'data') {
        dataListeners.push(listener as (data: string) => void)
      } else if (event === 'close') {
        closeListeners.push(listener as () => void)
      }
      return createMockSockJSConnection()
    }),
    off: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (event === 'data') {
        const idx = dataListeners.indexOf(listener as (data: string) => void)
        if (idx >= 0) dataListeners.splice(idx, 1)
      } else if (event === 'close') {
        const idx = closeListeners.indexOf(listener as () => void)
        if (idx >= 0) closeListeners.splice(idx, 1)
      }
      return createMockSockJSConnection()
    }),
    removeListener: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (event === 'data') {
        const idx = dataListeners.indexOf(listener as (data: string) => void)
        if (idx >= 0) dataListeners.splice(idx, 1)
      } else if (event === 'close') {
        const idx = closeListeners.indexOf(listener as () => void)
        if (idx >= 0) closeListeners.splice(idx, 1)
      }
      return createMockSockJSConnection()
    }),
    simulateData: (data: string) => {
      for (const listener of dataListeners) {
        listener(data)
      }
    },
    simulateClose: () => {
      for (const listener of closeListeners) {
        listener()
      }
    },
  }
}

describe('SockJSNodeAdapter', () => {
  let mockConn: ReturnType<typeof createMockSockJSConnection>
  let adapter: SockJSNodeAdapter

  beforeEach(() => {
    mockConn = createMockSockJSConnection()
    adapter = new SockJSNodeAdapter(mockConn)
  })

  describe('readyState', () => {
    it('should return the connection readyState', () => {
      expect(adapter.readyState).toBe(1)
    })
  })

  describe('send', () => {
    it('should call write() on the connection', () => {
      adapter.send('test data')
      expect(mockConn.write).toHaveBeenCalledWith('test data')
    })

    it('should call callback on success', () => {
      const callback = vi.fn()
      adapter.send('test data', callback)
      expect(callback).toHaveBeenCalledWith()
    })

    it('should call callback with error on failure', () => {
      const error = new Error('Write failed')
      mockConn.write = vi.fn(() => {
        throw error
      })
      const callback = vi.fn()

      adapter.send('test data', callback)

      expect(callback).toHaveBeenCalledWith(error)
    })
  })

  describe('close', () => {
    it('should call close() on the connection', () => {
      adapter.close()
      expect(mockConn.close).toHaveBeenCalled()
    })

    it('should pass code and reason to close()', () => {
      adapter.close(1000, 'Normal closure')
      expect(mockConn.close).toHaveBeenCalledWith(1000, 'Normal closure')
    })
  })

  describe('addEventListener', () => {
    it('should convert message listener to data listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('message', listener)

      expect(mockConn.on).toHaveBeenCalledWith('data', expect.any(Function))
    })

    it('should wrap data in event object for message listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('message', listener)

      mockConn.simulateData('{"test": 1}')

      expect(listener).toHaveBeenCalledWith({ data: '{"test": 1}' })
    })

    it('should register close listener directly', () => {
      const listener = vi.fn()
      adapter.addEventListener('close', listener)

      expect(mockConn.on).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('should call close listener on close event', () => {
      const listener = vi.fn()
      adapter.addEventListener('close', listener)

      mockConn.simulateClose()

      expect(listener).toHaveBeenCalled()
    })

    it('should ignore open event (sockjs-node connections are already open)', () => {
      const listener = vi.fn()
      adapter.addEventListener('open', listener)

      // on() should not be called for 'open' event
      expect(mockConn.on).not.toHaveBeenCalledWith('open', expect.any(Function))
    })
  })

  describe('removeEventListener', () => {
    it('should remove message listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('message', listener)

      adapter.removeEventListener('message', listener)

      expect(mockConn.off).toHaveBeenCalledWith('data', expect.any(Function))
    })

    it('should stop receiving data after removing message listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('message', listener)
      adapter.removeEventListener('message', listener)

      mockConn.simulateData('{"test": 1}')

      expect(listener).not.toHaveBeenCalled()
    })

    it('should remove close listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('close', listener)

      adapter.removeEventListener('close', listener)

      expect(mockConn.off).toHaveBeenCalledWith('close', expect.any(Function))
    })

    it('should stop receiving close after removing close listener', () => {
      const listener = vi.fn()
      adapter.addEventListener('close', listener)
      adapter.removeEventListener('close', listener)

      mockConn.simulateClose()

      expect(listener).not.toHaveBeenCalled()
    })

    it('should do nothing when removing non-existent listener', () => {
      const listener = vi.fn()

      // Should not throw
      adapter.removeEventListener('message', listener)
      adapter.removeEventListener('close', listener)

      expect(mockConn.off).not.toHaveBeenCalled()
    })
  })

  describe('multiple listeners', () => {
    it('should support multiple message listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      adapter.addEventListener('message', listener1)
      adapter.addEventListener('message', listener2)

      mockConn.simulateData('test')

      expect(listener1).toHaveBeenCalledWith({ data: 'test' })
      expect(listener2).toHaveBeenCalledWith({ data: 'test' })
    })

    it('should only remove the specific listener', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      adapter.addEventListener('message', listener1)
      adapter.addEventListener('message', listener2)

      adapter.removeEventListener('message', listener1)

      mockConn.simulateData('test')

      expect(listener1).not.toHaveBeenCalled()
      expect(listener2).toHaveBeenCalledWith({ data: 'test' })
    })
  })
})
