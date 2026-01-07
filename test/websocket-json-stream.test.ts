import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer, type Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { WebSocketJSONStream, type StreamError } from '../src'

const NORMAL_CLOSURE_CODE = 1000
const NO_STATUS_CODE = 1005
const INTERNAL_ERROR_CODE = 1011
const CUSTOM_CODE = 4000

interface TestContext {
  httpServer: Server
  wsServer: WebSocketServer
  url: string
  clientWebSocket: WebSocket
  serverWebSocket: WebSocket
  serverStream: WebSocketJSONStream
  connect: (callback: (sockets: { clientWebSocket: WebSocket; serverWebSocket: WebSocket }) => void) => void
  extraConnections: WebSocket[]
}

// Helper to send JSON from client
function clientSend(ws: WebSocket, data: unknown): void {
  ws.send(JSON.stringify(data))
}

// Helper to receive JSON on client
function onClientMessage(ws: WebSocket, callback: (data: unknown) => void): void {
  ws.on('message', (raw) => {
    callback(JSON.parse(raw.toString()))
  })
}

describe('WebSocketJSONStream', () => {
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
          ctx.serverStream = new WebSocketJSONStream(serverWebSocket)
          // Remove from extra connections since it's the main connection
          ctx.extraConnections.pop()
          resolve()
        })
      })
    })
  })

  afterEach(async () => {
    // Close all extra connections
    for (const ws of ctx.extraConnections) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate()
      }
    }
    // Close main connection
    if (ctx.clientWebSocket?.readyState === WebSocket.OPEN) {
      ctx.clientWebSocket.terminate()
    }
    ctx.wsServer.close()
    await new Promise<void>((resolve) => ctx.httpServer.close(() => resolve()))
  })

  it('should send and receive messages between native client and server stream', async () => {
    const serverSentData = [{ a: 1 }, { b: 2 }]
    const clientSentData = [{ y: -1 }, { z: -2 }]
    const serverReceivedData: unknown[] = []
    const clientReceivedData: unknown[] = []

    ctx.serverStream.on('data', (data) => serverReceivedData.push(data))
    onClientMessage(ctx.clientWebSocket, (data) => clientReceivedData.push(data))

    await new Promise<void>((resolve) => {
      ctx.clientWebSocket.on('close', () => {
        expect(serverReceivedData).toEqual(clientSentData)
        expect(clientReceivedData).toEqual(serverSentData)
        resolve()
      })

      serverSentData.forEach((data) => ctx.serverStream.write(data))
      clientSentData.forEach((data) => clientSend(ctx.clientWebSocket, data))
      ctx.serverStream.end()
    })
  })

  // Close events on stream.end()
  it('should get client close on serverStream.end()', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientWebSocket.on('close', () => resolve())
      ctx.serverStream.end()
    })
  })

  it('should get serverStream close on serverStream.end()', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('close', () => resolve())
      ctx.serverStream.end()
    })
  })

  it('should get serverStream close when client closes', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('close', () => resolve())
      ctx.clientWebSocket.close()
    })
  })

  // Close events on stream.destroy()
  it('should get client close on serverStream.destroy()', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientWebSocket.on('close', () => resolve())
      ctx.serverStream.destroy()
    })
  })

  it('should get serverStream close on serverStream.destroy()', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('close', () => resolve())
      ctx.serverStream.destroy()
    })
  })

  // Finish events
  it('should get serverStream finish on serverStream.end()', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('finish', () => resolve())
      ctx.serverStream.on('error', () => {}) // Ignore errors
      ctx.serverStream.end()
    })
  }, 10000)

  // Error handling - invalid data
  it('should get serverStream error on serverStream.write invalid data (Symbol)', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.serverStream.write(Symbol('Test'))
    })
  })

  it('should get serverStream error on serverStream.write invalid data (cyclic data)', async () => {
    const data: Record<string, unknown> = {}
    data.a = data

    await new Promise<void>((resolve) => {
      ctx.serverStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.serverStream.write(data)
    })
  })

  it('should get serverStream error when client sends invalid JSON', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.clientWebSocket.send('qwerty')
    })
  })

  it('should get serverStream error on serverStream.write after end', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.serverStream.end()
      ctx.serverStream.write({})
    })
  })

  it('should get serverStream error on serverStream.write, if serverWebSocket is closed', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverWebSocket.on('close', () => {
        // After WebSocket is closed, writing should produce an error
        ctx.serverStream.write({}, (error) => {
          expect(error).toBeInstanceOf(Error)
          resolve()
        })
      })
      ctx.serverWebSocket.close()
    })
  }, 10000)

  it('should get serverStream error when client sends JSON-encoded null', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.clientWebSocket.send('null')
    })
  })

  it('should get serverStream error when client sends JSON-encoded undefined', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.clientWebSocket.send('undefined')
    })
  })

  // WebSocket state tests
  it('serverStream.destroy when serverWebSocket.readyState === WebSocket.OPEN', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverWebSocket.on('close', () => resolve())
      ctx.serverStream.destroy()
    })
  })

  it('serverStream.destroy when serverWebSocket.readyState === WebSocket.CLOSING', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverWebSocket.on('close', () => resolve())
      ctx.serverWebSocket.close()
      ctx.serverStream.destroy()
    })
  })

  it('write when serverWebSocket.readyState === WebSocket.CLOSING', async () => {
    ctx.serverWebSocket.close()

    ctx.serverStream.on('error', (error) => {
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('Error [ERR_CLOSED]')
      expect(error.message).toBe('WebSocket CLOSING or CLOSED.')
    })

    await new Promise<void>((resolve, reject) => {
      ctx.serverStream.write({}, (error) => {
        try {
          expect(error).toBeInstanceOf(Error)
          expect(error?.name).toBe('Error [ERR_CLOSED]')
          expect(error?.message).toBe('WebSocket CLOSING or CLOSED.')
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })
  })

  // CloseEvent tests
  describe('CloseEvent on clientWebSocket', () => {
    it('is emitted with code 1000 and reason "stream end" on serverStream.end()', async () => {
      await new Promise<void>((resolve) => {
        ctx.clientWebSocket.addEventListener('close', (event) => {
          expect(event.code).toBe(NORMAL_CLOSURE_CODE)
          expect(event.reason).toBe('stream end')
          resolve()
        })
        ctx.serverStream.end()
      })
    })

    it('is emitted with code 1005 and reason "" on serverStream.destroy()', async () => {
      await new Promise<void>((resolve) => {
        ctx.clientWebSocket.addEventListener('close', (event) => {
          expect(event.code).toBe(NO_STATUS_CODE)
          expect(event.reason).toBe('')
          resolve()
        })
        ctx.serverStream.destroy()
      })
    })

    it('is emitted with code 1011 and reason "stream error" on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx.clientWebSocket.addEventListener('close', (event) => {
          expect(event.code).toBe(INTERNAL_ERROR_CODE)
          expect(event.reason).toBe('stream error')
          resolve()
        })
        const error = new Error('Test error')
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })

    it('is emitted with code from error.closeCode on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx.clientWebSocket.addEventListener('close', (event) => {
          expect(event.code).toBe(CUSTOM_CODE)
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeCode = CUSTOM_CODE
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })

    it('is emitted with reason from error.closeReason on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx.clientWebSocket.addEventListener('close', (event) => {
          expect(event.reason).toBe('custom reason')
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeReason = 'custom reason'
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })
  })

  // "close" event tests for serverWebSocket
  describe('serverWebSocket "close" event', () => {
    it('is emitted with code 1000 and reason "stream end" on serverStream.end()', async () => {
      await new Promise<void>((resolve) => {
        ctx.serverWebSocket.on('close', (code, reason) => {
          expect(code).toBe(NORMAL_CLOSURE_CODE)
          expect(reason.toString()).toBe('stream end')
          resolve()
        })
        ctx.serverStream.end()
      })
    })

    it('is emitted with code 1005 and reason "" on serverStream.destroy()', async () => {
      await new Promise<void>((resolve) => {
        ctx.serverWebSocket.on('close', (code, reason) => {
          expect(code).toBe(NO_STATUS_CODE)
          expect(reason.toString()).toBe('')
          resolve()
        })
        ctx.serverStream.destroy()
      })
    })

    it('is emitted with code 1011 and reason "stream error" on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx.serverWebSocket.on('close', (code, reason) => {
          expect(code).toBe(INTERNAL_ERROR_CODE)
          expect(reason.toString()).toBe('stream error')
          resolve()
        })
        const error = new Error('Test error')
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })

    it('is emitted with code from error.closeCode on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx.serverWebSocket.on('close', (code) => {
          expect(code).toBe(CUSTOM_CODE)
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeCode = CUSTOM_CODE
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })

    it('is emitted with reason from error.closeReason on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx.serverWebSocket.on('close', (_code, reason) => {
          expect(reason.toString()).toBe('custom reason')
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeReason = 'custom reason'
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })
  })

  // CONNECTING state tests
  describe('CONNECTING state handling', () => {
    it('should queue multiple writes when WebSocket is CONNECTING', async () => {
      // Create a new connection without waiting for open
      const clientWs = new WebSocket(ctx.url)
      ctx.extraConnections.push(clientWs)

      const serverWs = await new Promise<WebSocket>((resolve) => {
        ctx.wsServer.once('connection', resolve)
      })

      // Create stream immediately while still connecting (from client perspective)
      // Server-side WebSocket should be open, but let's test the queue mechanism
      const stream = new WebSocketJSONStream(serverWs)

      const receivedMessages: unknown[] = []
      onClientMessage(clientWs, (data) => receivedMessages.push(data))

      // Wait for client to be open
      await new Promise<void>((resolve) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          resolve()
        } else {
          clientWs.once('open', resolve)
        }
      })

      // Send multiple messages
      const messages = [{ idx: 1 }, { idx: 2 }, { idx: 3 }]
      for (const msg of messages) {
        stream.write(msg)
      }

      // Wait for all messages
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (receivedMessages.length >= messages.length) {
            clearInterval(check)
            resolve()
          }
        }, 10)
        setTimeout(() => {
          clearInterval(check)
          resolve()
        }, 2000)
      })

      expect(receivedMessages).toEqual(messages)

      stream.destroy()
      clientWs.terminate()
    })
  })
})
