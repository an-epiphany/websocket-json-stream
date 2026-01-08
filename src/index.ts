export { WebSocketJSONStream, type WebSocketLike, type StreamError } from './websocket-json-stream'

// Adapter exports for advanced usage
export {
  adaptWebSocket,
  isWebSocketLike,
  isSockJSNodeConnection,
  isSocketIOSocket,
  SockJSNodeAdapter,
  SocketIOAdapter,
  type SockJSNodeConnection,
  type SocketIOSocket,
  type AdaptableWebSocket,
  type AdapterType,
} from './adapters'
