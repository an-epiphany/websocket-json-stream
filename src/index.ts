export { WebSocketJSONStream, type WebSocketLike, type StreamError } from './websocket-json-stream'

// Adapter exports for advanced usage
export {
  adaptWebSocket,
  isWebSocketLike,
  isSockJSNodeConnection,
  SockJSNodeAdapter,
  type SockJSNodeConnection,
  type AdaptableWebSocket,
  type AdapterType,
} from './adapters'
