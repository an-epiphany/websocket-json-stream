import type { WebSocketLike } from '../websocket-json-stream'
import type { SocketIOSocket } from './types'

type MessageListener = (event: { data: string }) => void
type CloseListener = () => void

/**
 * Socket.IO socket adapter
 * Converts Socket.IO's EventEmitter style API to WebSocketLike interface
 */
export class SocketIOAdapter implements WebSocketLike {
  private readonly socket: SocketIOSocket
  private readonly messageListeners: Map<MessageListener, (data: string) => void>
  private readonly closeListeners: Map<CloseListener, (reason: string) => void>

  constructor(socket: SocketIOSocket) {
    this.socket = socket
    this.messageListeners = new Map()
    this.closeListeners = new Map()
  }

  get readyState(): number {
    // Map Socket.IO's connected boolean to WebSocket readyState
    // OPEN = 1, CLOSED = 3
    return this.socket.connected ? 1 : 3
  }

  send(data: string, callback?: (error?: Error) => void): void {
    try {
      // Socket.IO emit is fire-and-forget for the 'message' event
      this.socket.emit('message', data)
      // Call callback on success (emit doesn't throw for send failures)
      callback?.()
    } catch (error) {
      callback?.(error as Error)
    }
  }

  close(_code?: number, _reason?: string): void {
    // Socket.IO doesn't support close codes/reasons like WebSocket
    // The 'close' parameter in disconnect() controls whether to also close underlying connection
    this.socket.disconnect(true)
  }

  addEventListener(type: 'message', listener: MessageListener): void
  addEventListener(type: 'open' | 'close', listener: CloseListener): void
  addEventListener(
    type: 'message' | 'open' | 'close',
    listener: MessageListener | CloseListener
  ): void {
    if (type === 'message') {
      const msgListener = listener as MessageListener
      const wrappedListener = (data: string): void => {
        msgListener({ data })
      }
      this.messageListeners.set(msgListener, wrappedListener)
      this.socket.on('message', wrappedListener)
    } else if (type === 'close') {
      const closeListener = listener as CloseListener
      // Socket.IO disconnect event passes reason, but WebSocket close doesn't
      const wrappedListener = (_reason: string): void => {
        closeListener()
      }
      this.closeListeners.set(closeListener, wrappedListener)
      this.socket.on('disconnect', wrappedListener)
    }
    // 'open' event: Socket.IO sockets are already connected when received from 'connection' event
    // No need to handle 'open' event
  }

  removeEventListener(type: 'message', listener: MessageListener): void
  removeEventListener(type: 'open' | 'close', listener: CloseListener): void
  removeEventListener(
    type: 'message' | 'open' | 'close',
    listener: MessageListener | CloseListener
  ): void {
    if (type === 'message') {
      const msgListener = listener as MessageListener
      const wrappedListener = this.messageListeners.get(msgListener)
      if (wrappedListener) {
        this.socket.off('message', wrappedListener)
        this.messageListeners.delete(msgListener)
      }
    } else if (type === 'close') {
      const closeListener = listener as CloseListener
      const wrappedListener = this.closeListeners.get(closeListener)
      if (wrappedListener) {
        this.socket.off('disconnect', wrappedListener)
        this.closeListeners.delete(closeListener)
      }
    }
  }

  /**
   * Clear all event listeners and internal maps
   * Call this when the connection is being closed to prevent memory leaks
   */
  clearAllListeners(): void {
    // Remove all message listeners
    for (const [, wrappedListener] of this.messageListeners) {
      this.socket.off('message', wrappedListener)
    }
    this.messageListeners.clear()

    // Remove all close listeners
    for (const [, wrappedListener] of this.closeListeners) {
      this.socket.off('disconnect', wrappedListener)
    }
    this.closeListeners.clear()
  }
}
