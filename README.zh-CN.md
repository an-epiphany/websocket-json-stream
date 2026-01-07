<div align="center">

# websocket-json-stream

[![license](https://img.shields.io/npm/l/websocket-json-stream?color=blue)](./LICENSE)
[![typescript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![node](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)

Node.js Duplex 流封装，用于 WebSocket 连接的自动 JSON 序列化。

支持 Node.js WebSockets (ws) 和 **SockJS**。

[English](./README.md) | [中文](./README.zh-CN.md)

</div>

---

## 特性

- **TypeScript 优先** - 完整的类型定义和泛型支持
- **双包支持** - 同时支持 ESM 和 CommonJS
- **SockJS 适配器** - 内置 SockJS 支持，带 HTTP 降级
- **零依赖** - 仅需 WebSocket 库作为对等依赖
- **类型安全消息** - 泛型类型实现编译时消息校验

## 安装

```bash
npm install @an-epiphany/websocket-json-stream
# 或
pnpm add @an-epiphany/websocket-json-stream
# 或
yarn add @an-epiphany/websocket-json-stream
```

## 快速开始

### 服务端

```typescript
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', (ws) => {
  const stream = new WebSocketJSONStream(ws)

  stream.on('data', (data) => {
    console.log('收到:', data)
    stream.write({ echo: data })
  })
})
```

### 客户端（原生 WebSocket）

```typescript
import { WebSocket } from 'ws'

const ws = new WebSocket('ws://localhost:8080')

ws.on('open', () => {
  ws.send(JSON.stringify({ message: '你好！' }))
})

ws.on('message', (data) => {
  const message = JSON.parse(data.toString())
  console.log('收到:', message)
})
```

## 类型安全消息

```typescript
interface ChatMessage {
  type: 'message' | 'join' | 'leave'
  user: string
  content?: string
}

const stream = new WebSocketJSONStream<ChatMessage>(ws)

stream.on('data', (msg) => {
  // msg 被类型化为 ChatMessage
  switch (msg.type) {
    case 'message':
      console.log(`${msg.user}: ${msg.content}`)
      break
    case 'join':
      console.log(`${msg.user} 加入了`)
      break
  }
})

stream.write({ type: 'message', user: 'Alice', content: '你好！' })
```

## SockJS 支持

SockJS 提供类似 WebSocket 的 API，当 WebSocket 不可用时自动降级到 HTTP 传输。

### 服务端 (sockjs-node)

```typescript
import { WebSocketJSONStream } from '@an-epiphany/websocket-json-stream'
import sockjs from 'sockjs'
import http from 'http'

const server = sockjs.createServer()

server.on('connection', (conn) => {
  // 服务端连接使用 'sockjs-node' 适配器
  const stream = new WebSocketJSONStream(conn, 'sockjs-node')

  stream.on('data', (data) => {
    stream.write({ echo: data })
  })
})

const httpServer = http.createServer()
server.installHandlers(httpServer, { prefix: '/sockjs' })
httpServer.listen(8080)
```

### 客户端 (sockjs-client)

```typescript
import SockJS from 'sockjs-client'

const sock = new SockJS('http://localhost:8080/sockjs')

sock.onopen = () => {
  sock.send(JSON.stringify({ message: '通过 SockJS 发送！' }))
}

sock.onmessage = (e) => {
  const message = JSON.parse(e.data)
  console.log('收到:', message)
}
```

### 为什么选择 SockJS？

| 场景 | 解决方案 |
|------|----------|
| WebSocket 被防火墙/代理阻止 | 自动降级到 XHR streaming |
| 企业网络环境 | 降级到长轮询 |
| WebSocket 连接不稳定 | 多种传输选项 |

## API 参考

### 构造函数

```typescript
new WebSocketJSONStream<T>(ws: AdaptableWebSocket, adapterType?: AdapterType)
```

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `ws` | `AdaptableWebSocket` | - | WebSocket 或 SockJS 连接 |
| `adapterType` | `'ws' \| 'sockjs-node' \| 'auto'` | `'ws'` | 适配器类型 |
| `T` | 泛型 | `unknown` | 消息类型 |

### 事件

| 事件 | 载荷 | 描述 |
|------|------|------|
| `data` | `T` | 收到 JSON 消息 |
| `error` | `Error` | 解析/写入错误 |
| `close` | - | 流已关闭 |
| `finish` | - | 写入端已结束 |

### 方法

| 方法 | 描述 |
|------|------|
| `write(data: T)` | 发送 JSON 消息 |
| `end()` | 以码 1000 关闭 |
| `destroy(error?)` | 强制关闭 |

## 关闭连接

```typescript
// 正常关闭 (码: 1000)
stream.end()

// 无状态码关闭 (码: 1005)
stream.destroy()

// 带错误关闭 (码: 1011)
stream.destroy(new Error('出错了'))

// 自定义关闭码 (3000-4999)
const error = new Error('自定义') as StreamError
error.closeCode = 4000
error.closeReason = '自定义原因'
stream.destroy(error)
```

## 错误处理

```typescript
// 处理 WebSocket 错误（流不处理）
ws.on('error', (error) => {
  console.error('WebSocket 错误:', error)
})

// 处理流错误
stream.on('error', (error) => {
  console.error('流错误:', error)
})
```

## 高级：适配器工具

```typescript
import {
  adaptWebSocket,
  isWebSocketLike,
  isSockJSNodeConnection,
  SockJSNodeAdapter,
} from '@an-epiphany/websocket-json-stream'

// 类型检查
if (isSockJSNodeConnection(conn)) {
  console.log('SockJS Node 连接')
}

// 手动适配
const adapted = adaptWebSocket(conn, 'auto')
```

## 类型

```typescript
interface WebSocketLike {
  readonly readyState: number
  send(data: string, callback?: (error?: Error) => void): void
  close(code?: number, reason?: string): void
  addEventListener(type: string, listener: Function): void
  removeEventListener(type: string, listener: Function): void
}

interface SockJSNodeConnection {
  readonly readyState: number
  write(data: string): boolean
  close(code?: number, reason?: string): void
  on(event: 'data' | 'close', listener: Function): this
  off(event: 'data' | 'close', listener: Function): this
}

interface StreamError extends Error {
  closeCode?: number
  closeReason?: string
}

type AdaptableWebSocket = WebSocketLike | SockJSNodeConnection
type AdapterType = 'ws' | 'sockjs-node' | 'auto'
```

## 许可证

[MIT](./LICENSE)

## 致谢

基于 Greg Kubisa 的 [@teamwork/websocket-json-stream](https://github.com/Teamwork/websocket-json-stream) 重写的 TypeScript 版本。
