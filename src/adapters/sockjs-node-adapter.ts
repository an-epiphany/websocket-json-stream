import type { WebSocketLike } from '../websocket-json-stream'
import type { SockJSNodeConnection } from './types'

type MessageListener = (event: { data: string }) => void
type CloseListener = () => void

/**
 * SockJS-node server connection adapter
 * Converts sockjs-node's Node.js style API to WebSocketLike interface
 */
export class SockJSNodeAdapter implements WebSocketLike {
  private readonly conn: SockJSNodeConnection
  private readonly messageListeners: Map<MessageListener, (data: string) => void>
  private readonly closeListeners: Map<CloseListener, CloseListener>

  constructor(conn: SockJSNodeConnection) {
    this.conn = conn
    this.messageListeners = new Map()
    this.closeListeners = new Map()
  }

  get readyState(): number {
    return this.conn.readyState
  }

  send(data: string, callback?: (error?: Error) => void): void {
    try {
      this.conn.write(data)
      // sockjs-node write() is synchronous, call callback on success
      callback?.()
    } catch (error) {
      callback?.(error as Error)
    }
  }

  close(code?: number, reason?: string): void {
    this.conn.close(code, reason)
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
      this.conn.on('data', wrappedListener)
    } else if (type === 'close') {
      const closeListener = listener as CloseListener
      this.closeListeners.set(closeListener, closeListener)
      this.conn.on('close', closeListener)
    }
    // 'open' event: sockjs-node connections are already open at 'connection' event
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
        this.conn.off('data', wrappedListener)
        this.messageListeners.delete(msgListener)
      }
    } else if (type === 'close') {
      const closeListener = listener as CloseListener
      const wrappedListener = this.closeListeners.get(closeListener)
      if (wrappedListener) {
        this.conn.off('close', wrappedListener)
        this.closeListeners.delete(closeListener)
      }
    }
  }
}
