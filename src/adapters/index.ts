import type { WebSocketLike } from '../websocket-json-stream'
import type { SockJSNodeConnection, SocketIOSocket, AdaptableWebSocket } from './types'
import { SockJSNodeAdapter } from './sockjs-node-adapter'
import { SocketIOAdapter } from './socketio-adapter'

/**
 * Adapter type for explicit specification
 * - 'ws': Standard WebSocket (default, no adaptation)
 * - 'sockjs-node': SockJS Node server connection adapter
 * - 'socketio': Socket.IO socket adapter
 * - 'auto': Auto-detect based on object features
 */
export type AdapterType = 'ws' | 'sockjs-node' | 'socketio' | 'auto'

/**
 * Detect if the object is a sockjs-node server connection
 * Signature: has write() but no send(), has on() but no addEventListener()
 */
export function isSockJSNodeConnection(ws: unknown): ws is SockJSNodeConnection {
  if (ws === null || typeof ws !== 'object') return false

  const obj = ws as Record<string, unknown>

  return (
    typeof obj.readyState === 'number' &&
    typeof obj.write === 'function' &&
    typeof obj.on === 'function' &&
    typeof obj.off === 'function' &&
    typeof obj.close === 'function' &&
    // Key distinction: sockjs-node lacks send and addEventListener
    typeof obj.send !== 'function' &&
    typeof obj.addEventListener !== 'function'
  )
}

/**
 * Detect if the object is a Socket.IO socket
 * Signature: has emit(), connected, id, on(), off(), disconnect()
 * but no readyState, send(), addEventListener()
 */
export function isSocketIOSocket(ws: unknown): ws is SocketIOSocket {
  if (ws === null || typeof ws !== 'object') return false

  const obj = ws as Record<string, unknown>

  return (
    typeof obj.id === 'string' &&
    typeof obj.connected === 'boolean' &&
    typeof obj.emit === 'function' &&
    typeof obj.on === 'function' &&
    typeof obj.off === 'function' &&
    typeof obj.disconnect === 'function' &&
    // Key distinction: Socket.IO lacks readyState, send, addEventListener
    typeof obj.readyState !== 'number' &&
    typeof obj.send !== 'function' &&
    typeof obj.addEventListener !== 'function'
  )
}

/**
 * Detect if the object is a standard WebSocket-like object
 */
export function isWebSocketLike(ws: unknown): ws is WebSocketLike {
  if (ws === null || typeof ws !== 'object') return false

  const obj = ws as Record<string, unknown>

  return (
    typeof obj.readyState === 'number' &&
    typeof obj.send === 'function' &&
    typeof obj.close === 'function' &&
    typeof obj.addEventListener === 'function' &&
    typeof obj.removeEventListener === 'function'
  )
}

/**
 * Adapt a WebSocket-like object
 * @param ws - WebSocket or compatible object
 * @param adapterType - Adapter type, defaults to 'ws' (no adaptation)
 *   - 'ws': Standard WebSocket, use directly without adaptation
 *   - 'sockjs-node': Use SockJS Node adapter
 *   - 'socketio': Use Socket.IO adapter
 *   - 'auto': Auto-detect object type and select adapter
 */
export function adaptWebSocket(ws: AdaptableWebSocket, adapterType: AdapterType = 'ws'): WebSocketLike {
  switch (adapterType) {
    case 'ws':
      // Explicitly specified ws, return directly (assume user knows what they're doing)
      return ws as WebSocketLike

    case 'sockjs-node':
      // Explicitly specified sockjs-node, use adapter
      return new SockJSNodeAdapter(ws as SockJSNodeConnection)

    case 'socketio':
      // Explicitly specified socketio, use adapter
      return new SocketIOAdapter(ws as SocketIOSocket)

    case 'auto':
      // Auto-detect mode
      if (isWebSocketLike(ws)) {
        return ws
      }
      if (isSockJSNodeConnection(ws)) {
        return new SockJSNodeAdapter(ws)
      }
      if (isSocketIOSocket(ws)) {
        return new SocketIOAdapter(ws)
      }
      throw new Error(
        'Unsupported WebSocket type. Expected a standard WebSocket, sockjs-node connection, or Socket.IO socket.'
      )

    default:
      throw new Error(`Unknown adapter type: ${adapterType}`)
  }
}

export { SockJSNodeAdapter } from './sockjs-node-adapter'
export { SocketIOAdapter } from './socketio-adapter'
export type { SockJSNodeConnection, SocketIOSocket, AdaptableWebSocket } from './types'
