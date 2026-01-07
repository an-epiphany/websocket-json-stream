import type { WebSocketLike } from '../websocket-json-stream'
import type { SockJSNodeConnection, AdaptableWebSocket } from './types'
import { SockJSNodeAdapter } from './sockjs-node-adapter'

/**
 * Adapter type for explicit specification
 * - 'ws': Standard WebSocket (default, no adaptation)
 * - 'sockjs-node': SockJS Node server connection adapter
 * - 'auto': Auto-detect based on object features
 */
export type AdapterType = 'ws' | 'sockjs-node' | 'auto'

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

    case 'auto':
      // Auto-detect mode
      if (isWebSocketLike(ws)) {
        return ws
      }
      if (isSockJSNodeConnection(ws)) {
        return new SockJSNodeAdapter(ws)
      }
      throw new Error(
        'Unsupported WebSocket type. Expected a standard WebSocket or sockjs-node connection.'
      )

    default:
      throw new Error(`Unknown adapter type: ${adapterType}`)
  }
}

export { SockJSNodeAdapter } from './sockjs-node-adapter'
export type { SockJSNodeConnection, AdaptableWebSocket } from './types'
