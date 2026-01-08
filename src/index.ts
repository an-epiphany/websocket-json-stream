export {
  WebSocketJSONStream,
  jsonSerializer,
  type WebSocketLike,
  type StreamError,
  type Serializer,
  type WebSocketJSONStreamOptions,
} from './websocket-json-stream'

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
