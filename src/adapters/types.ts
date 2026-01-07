import type { WebSocketLike } from '../websocket-json-stream'

/**
 * SockJS-node server connection interface
 * Uses Node.js EventEmitter style API
 */
export interface SockJSNodeConnection {
  readonly readyState: number
  write(data: string): boolean
  close(code?: number, reason?: string): void
  end(data?: string, encoding?: string): void
  on(event: 'data', listener: (message: string) => void): this
  on(event: 'close', listener: () => void): this
  off(event: 'data', listener: (message: string) => void): this
  off(event: 'close', listener: () => void): this
  removeListener(event: 'data', listener: (message: string) => void): this
  removeListener(event: 'close', listener: () => void): this
}

/**
 * Union type for adaptable WebSocket-like objects
 * Supports standard WebSocket and sockjs-node connections
 */
export type AdaptableWebSocket = WebSocketLike | SockJSNodeConnection
