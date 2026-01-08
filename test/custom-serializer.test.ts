import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer, type Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { WebSocketJSONStream, jsonSerializer, type Serializer } from '../src'

interface TestContext {
  httpServer: Server
  wsServer: WebSocketServer
  url: string
  clientWebSocket: WebSocket
  serverWebSocket: WebSocket
  extraConnections: WebSocket[]
  connect: (
    callback: (sockets: { clientWebSocket: WebSocket; serverWebSocket: WebSocket }) => void
  ) => void
}

describe('Custom Serializer', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = { extraConnections: [] } as TestContext
    ctx.httpServer = createServer()
    ctx.wsServer = new WebSocketServer({ server: ctx.httpServer })

    await new Promise<void>((resolve) => {
      ctx.httpServer.listen(() => {
        const address = ctx.httpServer.address()
        if (typeof address === 'object' && address) {
          ctx.url = `http://[${address.address}]:${address.port}`
        }

        ctx.connect = (callback) => {
          const clientWebSocket = new WebSocket(ctx.url)
          ctx.extraConnections.push(clientWebSocket)

          ctx.wsServer.once('connection', (serverWebSocket) => {
            clientWebSocket.once('open', () => callback({ clientWebSocket, serverWebSocket }))
          })
        }

        ctx.connect(({ clientWebSocket, serverWebSocket }) => {
          ctx.clientWebSocket = clientWebSocket
          ctx.serverWebSocket = serverWebSocket
          ctx.extraConnections.pop()
          resolve()
        })
      })
    })
  })

  afterEach(async () => {
    for (const ws of ctx.extraConnections) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate()
      }
    }
    if (ctx.clientWebSocket?.readyState === WebSocket.OPEN) {
      ctx.clientWebSocket.terminate()
    }
    ctx.wsServer?.close()
    await new Promise<void>((resolve) => {
      ctx.httpServer?.close(() => resolve())
    })
  })

  describe('jsonSerializer (default)', () => {
    it('should export jsonSerializer', () => {
      expect(jsonSerializer).toBeDefined()
      expect(typeof jsonSerializer.serialize).toBe('function')
      expect(typeof jsonSerializer.deserialize).toBe('function')
    })

    it('should serialize objects to JSON strings', () => {
      const data = { foo: 'bar', num: 42 }
      const result = jsonSerializer.serialize(data)
      expect(result).toBe('{"foo":"bar","num":42}')
    })

    it('should deserialize JSON strings to objects', () => {
      const json = '{"foo":"bar","num":42}'
      const result = jsonSerializer.deserialize(json)
      expect(result).toEqual({ foo: 'bar', num: 42 })
    })
  })

  describe('constructor with options object', () => {
    it('should accept options object with adapterType', async () => {
      const stream = new WebSocketJSONStream(ctx.serverWebSocket, { adapterType: 'ws' })
      expect(stream).toBeInstanceOf(WebSocketJSONStream)
      stream.destroy()
    })

    it('should accept options object with custom serializer', async () => {
      const customSerializer: Serializer<unknown> = {
        serialize: (v) => JSON.stringify(v),
        deserialize: (d) => JSON.parse(d),
      }
      const stream = new WebSocketJSONStream(ctx.serverWebSocket, {
        serializer: customSerializer,
      })
      expect(stream).toBeInstanceOf(WebSocketJSONStream)
      stream.destroy()
    })

    it('should accept options object with both adapterType and serializer', async () => {
      const customSerializer: Serializer<unknown> = {
        serialize: (v) => JSON.stringify(v),
        deserialize: (d) => JSON.parse(d),
      }
      const stream = new WebSocketJSONStream(ctx.serverWebSocket, {
        adapterType: 'ws',
        serializer: customSerializer,
      })
      expect(stream).toBeInstanceOf(WebSocketJSONStream)
      stream.destroy()
    })
  })

  describe('backward compatibility', () => {
    it('should work with legacy constructor (no options)', async () => {
      const stream = new WebSocketJSONStream(ctx.serverWebSocket)
      expect(stream).toBeInstanceOf(WebSocketJSONStream)
      stream.destroy()
    })

    it('should work with legacy constructor (adapterType string)', async () => {
      const stream = new WebSocketJSONStream(ctx.serverWebSocket, 'ws')
      expect(stream).toBeInstanceOf(WebSocketJSONStream)
      stream.destroy()
    })
  })

  describe('custom serializer - send messages', () => {
    it('should use custom serializer for outgoing messages', async () => {
      const serializedMessages: string[] = []

      const customSerializer: Serializer<{ value: number }> = {
        serialize: (v) => {
          const result = `CUSTOM:${JSON.stringify(v)}`
          serializedMessages.push(result)
          return result
        },
        deserialize: (d) => JSON.parse(d.replace('CUSTOM:', '')),
      }

      const stream = new WebSocketJSONStream(ctx.serverWebSocket, {
        serializer: customSerializer,
      })

      const receivedOnClient = new Promise<string>((resolve) => {
        ctx.clientWebSocket.on('message', (data) => {
          resolve(data.toString())
        })
      })

      stream.write({ value: 123 })

      const received = await receivedOnClient
      expect(received).toBe('CUSTOM:{"value":123}')
      expect(serializedMessages).toContain('CUSTOM:{"value":123}')

      stream.destroy()
    })
  })

  describe('custom serializer - receive messages', () => {
    it('should use custom serializer for incoming messages', async () => {
      const deserializedMessages: unknown[] = []

      const customSerializer: Serializer<{ value: number }> = {
        serialize: (v) => `CUSTOM:${JSON.stringify(v)}`,
        deserialize: (d) => {
          const result = JSON.parse(d.replace('CUSTOM:', ''))
          deserializedMessages.push(result)
          return result
        },
      }

      const stream = new WebSocketJSONStream(ctx.serverWebSocket, {
        serializer: customSerializer,
      })

      const receivedOnServer = new Promise<{ value: number }>((resolve) => {
        stream.on('data', (data) => {
          resolve(data)
        })
      })

      ctx.clientWebSocket.send('CUSTOM:{"value":456}')

      const received = await receivedOnServer
      expect(received).toEqual({ value: 456 })
      expect(deserializedMessages).toContainEqual({ value: 456 })

      stream.destroy()
    })
  })

  describe('custom serializer - bidirectional', () => {
    it('should use custom serializer for both send and receive', async () => {
      // Base64 encoding serializer
      const base64Serializer: Serializer<unknown> = {
        serialize: (v) => Buffer.from(JSON.stringify(v)).toString('base64'),
        deserialize: (d) => JSON.parse(Buffer.from(d, 'base64').toString('utf-8')),
      }

      const stream = new WebSocketJSONStream(ctx.serverWebSocket, {
        serializer: base64Serializer,
      })

      // Test send
      const receivedOnClient = new Promise<string>((resolve) => {
        ctx.clientWebSocket.on('message', (data) => {
          resolve(data.toString())
        })
      })

      stream.write({ msg: 'hello' })

      const clientReceived = await receivedOnClient
      // Verify it's base64 encoded
      expect(clientReceived).toBe(Buffer.from('{"msg":"hello"}').toString('base64'))
      // Verify it decodes correctly
      expect(JSON.parse(Buffer.from(clientReceived, 'base64').toString())).toEqual({ msg: 'hello' })

      // Test receive
      const receivedOnServer = new Promise<unknown>((resolve) => {
        stream.on('data', resolve)
      })

      // Send base64 encoded message from client
      const encodedMsg = Buffer.from('{"msg":"world"}').toString('base64')
      ctx.clientWebSocket.send(encodedMsg)

      const serverReceived = await receivedOnServer
      expect(serverReceived).toEqual({ msg: 'world' })

      stream.destroy()
    })
  })

  describe('custom serializer - error handling', () => {
    it('should call write callback with error on serialize failure', async () => {
      const customSerializer: Serializer<unknown> = {
        serialize: () => {
          throw new Error('Serialize failed')
        },
        deserialize: (d) => JSON.parse(d),
      }

      const stream = new WebSocketJSONStream(ctx.serverWebSocket, {
        serializer: customSerializer,
      })

      // Suppress unhandled error
      stream.on('error', () => {})

      const writeError = await new Promise<Error | null | undefined>((resolve) => {
        stream.write({ test: 'data' }, (err) => {
          resolve(err)
        })
      })

      expect(writeError).toBeInstanceOf(Error)
      expect(writeError?.message).toBe('Serialize failed')

      stream.destroy()
    })

    it('should destroy stream on deserialize error', async () => {
      const customSerializer: Serializer<unknown> = {
        serialize: (v) => JSON.stringify(v),
        deserialize: () => {
          throw new Error('Deserialize failed')
        },
      }

      const stream = new WebSocketJSONStream(ctx.serverWebSocket, {
        serializer: customSerializer,
      })

      const errorPromise = new Promise<Error>((resolve) => {
        stream.on('error', resolve)
      })

      ctx.clientWebSocket.send('{"test":"data"}')

      const error = await errorPromise
      expect(error.message).toBe('Deserialize failed')

      stream.destroy()
    })

    it('should destroy stream when deserialize returns null', async () => {
      const customSerializer: Serializer<unknown> = {
        serialize: (v) => JSON.stringify(v),
        deserialize: () => null as unknown,
      }

      const stream = new WebSocketJSONStream(ctx.serverWebSocket, {
        serializer: customSerializer,
      })

      const errorPromise = new Promise<Error>((resolve) => {
        stream.on('error', resolve)
      })

      ctx.clientWebSocket.send('{"test":"data"}')

      const error = await errorPromise
      expect(error.message).toBe("Can't deserialize the value")

      stream.destroy()
    })
  })

  describe('custom serializer - type safety', () => {
    interface MyMessage {
      type: string
      payload: number
    }

    it('should preserve type information with typed serializer', async () => {
      const typedSerializer: Serializer<MyMessage> = {
        serialize: (v) => JSON.stringify(v),
        deserialize: (d) => JSON.parse(d) as MyMessage,
      }

      const stream = new WebSocketJSONStream<MyMessage>(ctx.serverWebSocket, {
        serializer: typedSerializer,
      })

      const receivedOnServer = new Promise<MyMessage>((resolve) => {
        stream.on('data', (data) => {
          // data is typed as MyMessage
          resolve(data)
        })
      })

      ctx.clientWebSocket.send('{"type":"test","payload":42}')

      const received = await receivedOnServer
      expect(received.type).toBe('test')
      expect(received.payload).toBe(42)

      stream.destroy()
    })
  })
})
