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
 * Socket.IO socket interface (v4.x)
 * Used for both server-side and client-side sockets
 */
export interface SocketIOSocket {
  readonly id: string
  readonly connected: boolean
  emit(event: string, ...args: unknown[]): this
  on(event: 'message', listener: (data: string) => void): this
  on(event: 'disconnect', listener: (reason: string) => void): this
  on(event: string, listener: (...args: unknown[]) => void): this
  off(event: 'message', listener: (data: string) => void): this
  off(event: 'disconnect', listener: (reason: string) => void): this
  off(event: string, listener: (...args: unknown[]) => void): this
  disconnect(close?: boolean): this
}

/**
 * Union type for adaptable WebSocket-like objects
 * Supports standard WebSocket, sockjs-node connections, and Socket.IO sockets
 */
export type AdaptableWebSocket = WebSocketLike | SockJSNodeConnection | SocketIOSocket
