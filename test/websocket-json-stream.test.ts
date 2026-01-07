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
  clientStream: WebSocketJSONStream
  serverStream: WebSocketJSONStream
  connect: (callback: (sockets: { clientWebSocket: WebSocket; serverWebSocket: WebSocket }) => void) => void
  extraConnections: WebSocket[]
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
          ctx.clientStream = new WebSocketJSONStream(clientWebSocket)
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

  it('should send and receive messages', async () => {
    const serverSentData = [{ a: 1 }, { b: 2 }]
    const clientSentData = [{ y: -1 }, { z: -2 }]
    const serverReceivedData: unknown[] = []
    const clientReceivedData: unknown[] = []

    ctx.serverStream.on('data', (data) => serverReceivedData.push(data))
    ctx.clientStream.on('data', (data) => clientReceivedData.push(data))

    await new Promise<void>((resolve) => {
      ctx.clientStream.on('close', () => {
        expect(serverReceivedData).toEqual(clientSentData)
        expect(clientReceivedData).toEqual(serverSentData)
        resolve()
      })

      serverSentData.forEach((data) => ctx.serverStream.write(data))
      clientSentData.forEach((data) => ctx.clientStream.write(data))
      ctx.clientStream.end()
    })
  })

  // Close events on stream.end()
  it('should get clientStream close on clientStream.end()', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.on('close', () => resolve())
      ctx.clientStream.end()
    })
  })

  it('should get clientStream close on serverStream.end()', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.on('close', () => resolve())
      ctx.serverStream.end()
    })
  })

  it('should get serverStream close on clientStream.end()', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('close', () => resolve())
      ctx.clientStream.end()
    })
  })

  it('should get serverStream close on serverStream.end()', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('close', () => resolve())
      ctx.serverStream.end()
    })
  })

  // Close events on stream.destroy()
  it('should get clientStream close on clientStream.destroy()', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.on('close', () => resolve())
      ctx.clientStream.destroy()
    })
  })

  it('should get clientStream close on serverStream.destroy()', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.on('close', () => resolve())
      ctx.serverStream.destroy()
    })
  })

  it('should get serverStream close on clientStream.destroy()', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('close', () => resolve())
      ctx.clientStream.destroy()
    })
  })

  it('should get serverStream close on serverStream.destroy()', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('close', () => resolve())
      ctx.serverStream.destroy()
    })
  })

  // Finish events
  it('should get clientStream finish on clientStream.end()', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.on('finish', () => resolve())
      ctx.clientStream.on('error', () => {}) // Ignore errors
      ctx.clientStream.end()
    })
  }, 10000)

  it('should get serverStream finish on serverStream.end()', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.on('finish', () => resolve())
      ctx.serverStream.on('error', () => {}) // Ignore errors
      ctx.serverStream.end()
    })
  }, 10000)

  // Error handling - invalid data
  it('should get clientStream error on clientStream.write invalid data (Symbol)', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.clientStream.write(Symbol('Test'))
    })
  })

  it('should get serverStream error on serverStream.write invalid data (Symbol)', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.serverStream.write(Symbol('Test'))
    })
  })

  it('should get clientStream error on clientStream.write invalid data (cyclic data)', async () => {
    const data: Record<string, unknown> = {}
    data.a = data

    await new Promise<void>((resolve) => {
      ctx.clientStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.clientStream.write(data)
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

  it('should get clientStream error on serverWebSocket.send invalid data', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.serverWebSocket.send('qwerty')
    })
  })

  it('should get serverStream error on clientWebSocket.send invalid data', async () => {
    await new Promise<void>((resolve) => {
      ctx.serverStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.clientWebSocket.send('qwerty')
    })
  })

  it('should get clientStream error on clientStream.write after end', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.once('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.clientStream.end()
      ctx.clientStream.write({})
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

  it('should get clientStream error on clientStream.write, if clientWebSocket is closed', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientWebSocket.on('close', () => {
        // After WebSocket is closed, writing should produce an error
        ctx.clientStream.write({}, (error) => {
          expect(error).toBeInstanceOf(Error)
          resolve()
        })
      })
      ctx.clientWebSocket.close()
    })
  }, 10000)

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

  it('should get clientStream error when clientWebSocket sends JSON-encoded null', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.on('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.serverWebSocket.send('null')
    })
  })

  it('should get clientStream error when clientWebSocket sends JSON-encoded undefined', async () => {
    await new Promise<void>((resolve) => {
      ctx.clientStream.on('error', (e) => {
        expect(e).toBeInstanceOf(Error)
        resolve()
      })
      ctx.serverWebSocket.send('undefined')
    })
  })

  // WebSocket state tests
  it('clientStream.destroy when clientWebSocket.readyState === WebSocket.CONNECTING', async () => {
    const clientWebSocket = new WebSocket(ctx.url)
    ctx.extraConnections.push(clientWebSocket)
    const clientStream = new WebSocketJSONStream(clientWebSocket)

    await new Promise<void>((resolve) => {
      clientStream.once('close', () => resolve())
      clientStream.destroy()
    })
  })

  it('clientStream.destroy when clientWebSocket.readyState === WebSocket.CONNECTING and gets error', async () => {
    const clientWebSocket = new WebSocket('http://invalid-url:0')
    ctx.extraConnections.push(clientWebSocket)
    const clientStream = new WebSocketJSONStream(clientWebSocket)

    clientWebSocket.on('error', () => null) // ignore invalid-url error

    await new Promise<void>((resolve) => {
      clientStream.on('close', () => resolve())
      clientStream.destroy()
    })
  })

  it('clientStream.destroy when clientWebSocket.readyState === WebSocket.OPEN', async () => {
    const clientWebSocket = new WebSocket(ctx.url)
    ctx.extraConnections.push(clientWebSocket)
    const clientStream = new WebSocketJSONStream(clientWebSocket)

    await new Promise<void>((resolve) => {
      clientWebSocket.on('close', () => resolve())
      clientWebSocket.on('open', () => clientStream.destroy())
    })
  })

  it('clientStream.destroy when clientWebSocket.readyState === WebSocket.CLOSING', async () => {
    const clientWebSocket = new WebSocket(ctx.url)
    ctx.extraConnections.push(clientWebSocket)
    const clientStream = new WebSocketJSONStream(clientWebSocket)

    await new Promise<void>((resolve) => {
      clientWebSocket.on('close', () => resolve())
      clientWebSocket.on('open', () => {
        clientWebSocket.close()
        clientStream.destroy()
      })
    })
  })

  it('clientStream.destroy when clientWebSocket.readyState === WebSocket.CLOSED', async () => {
    const clientWebSocket = new WebSocket(ctx.url)
    ctx.extraConnections.push(clientWebSocket)

    await new Promise<void>((resolve) => {
      clientWebSocket.on('close', () => {
        new WebSocketJSONStream(clientWebSocket).destroy()
        resolve()
      })
      clientWebSocket.on('open', () => clientWebSocket.close())
    })
  })

  it('write when clientWebSocket.readyState === WebSocket.CONNECTING', async () => {
    const clientWebSocket = new WebSocket(ctx.url)
    ctx.extraConnections.push(clientWebSocket)
    const clientStream = new WebSocketJSONStream(clientWebSocket)
    let opened = false

    clientWebSocket.on('open', () => {
      opened = true
    })

    await new Promise<void>((resolve, reject) => {
      clientStream.write({}, (error) => {
        try {
          // ws library passes null on success, not undefined
          expect(error == null).toBe(true)
          expect(opened).toBe(true)
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })
  })

  it('write when clientWebSocket.readyState === WebSocket.CONNECTING and gets error', async () => {
    const clientWebSocket = new WebSocket('http://invalid-url:0')
    ctx.extraConnections.push(clientWebSocket)
    const clientStream = new WebSocketJSONStream(clientWebSocket)
    let closed = false

    clientStream.on('error', (error) => {
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('Error [ERR_CLOSED]')
      expect(error.message).toBe('WebSocket CLOSING or CLOSED.')
    })

    clientWebSocket.on('error', () => null) // ignore invalid-url error
    clientWebSocket.on('close', () => {
      closed = true
    })

    await new Promise<void>((resolve, reject) => {
      clientStream.write({}, (error) => {
        try {
          expect(error).toBeInstanceOf(Error)
          expect(error?.name).toBe('Error [ERR_CLOSED]')
          expect(error?.message).toBe('WebSocket CLOSING or CLOSED.')
          expect(closed).toBe(true)
          resolve()
        } catch (e) {
          reject(e)
        }
      })
    })
  })

  it('write when clientWebSocket.readyState === WebSocket.CLOSING', async () => {
    ctx.clientWebSocket.close()

    ctx.clientStream.on('error', (error) => {
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('Error [ERR_CLOSED]')
      expect(error.message).toBe('WebSocket CLOSING or CLOSED.')
    })

    await new Promise<void>((resolve, reject) => {
      ctx.clientStream.write({}, (error) => {
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

  // CloseEvent tests for both client and server WebSockets
  describe.each(['clientWebSocket', 'serverWebSocket'] as const)('%s CloseEvent', (webSocketName) => {
    it('is emitted with code 1000 and reason "stream end" on clientStream.end()', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
          expect(event.code).toBe(NORMAL_CLOSURE_CODE)
          expect(event.reason).toBe('stream end')
          resolve()
        })
        ctx.clientStream.end()
      })
    })

    it('is emitted with code 1000 and reason "stream end" on serverStream.end()', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
          expect(event.code).toBe(NORMAL_CLOSURE_CODE)
          expect(event.reason).toBe('stream end')
          resolve()
        })
        ctx.serverStream.end()
      })
    })

    it('is emitted with code 1005 and reason "" on clientStream.destroy()', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
          expect(event.code).toBe(NO_STATUS_CODE)
          expect(event.reason).toBe('')
          resolve()
        })
        ctx.clientStream.destroy()
      })
    })

    it('is emitted with code 1005 and reason "" on serverStream.destroy()', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
          expect(event.code).toBe(NO_STATUS_CODE)
          expect(event.reason).toBe('')
          resolve()
        })
        ctx.serverStream.destroy()
      })
    })

    it('is emitted with code 1011 and reason "stream error" on clientStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
          expect(event.code).toBe(INTERNAL_ERROR_CODE)
          expect(event.reason).toBe('stream error')
          resolve()
        })
        const error = new Error('Test error')
        ctx.clientStream.on('error', () => {})
        ctx.clientStream.destroy(error)
      })
    })

    it('is emitted with code 1011 and reason "stream error" on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
          expect(event.code).toBe(INTERNAL_ERROR_CODE)
          expect(event.reason).toBe('stream error')
          resolve()
        })
        const error = new Error('Test error')
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })

    it('is emitted with code from error.closeCode on clientStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
          expect(event.code).toBe(CUSTOM_CODE)
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeCode = CUSTOM_CODE
        ctx.clientStream.on('error', () => {})
        ctx.clientStream.destroy(error)
      })
    })

    it('is emitted with code from error.closeCode on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
          expect(event.code).toBe(CUSTOM_CODE)
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeCode = CUSTOM_CODE
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })

    it('is emitted with reason from error.closeReason on clientStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
          expect(event.reason).toBe('custom reason')
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeReason = 'custom reason'
        ctx.clientStream.on('error', () => {})
        ctx.clientStream.destroy(error)
      })
    })

    it('is emitted with reason from error.closeReason on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].addEventListener('close', (event) => {
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

  // "close" event tests for both client and server WebSockets
  describe.each(['clientWebSocket', 'serverWebSocket'] as const)('%s "close" event', (webSocketName) => {
    it('is emitted with code 1000 and reason "stream end" on clientStream.end()', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (code, reason) => {
          expect(code).toBe(NORMAL_CLOSURE_CODE)
          expect(reason.toString()).toBe('stream end')
          resolve()
        })
        ctx.clientStream.end()
      })
    })

    it('is emitted with code 1000 and reason "stream end" on serverStream.end()', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (code, reason) => {
          expect(code).toBe(NORMAL_CLOSURE_CODE)
          expect(reason.toString()).toBe('stream end')
          resolve()
        })
        ctx.serverStream.end()
      })
    })

    it('is emitted with code 1005 and reason "" on clientStream.destroy()', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (code, reason) => {
          expect(code).toBe(NO_STATUS_CODE)
          expect(reason.toString()).toBe('')
          resolve()
        })
        ctx.clientStream.destroy()
      })
    })

    it('is emitted with code 1005 and reason "" on serverStream.destroy()', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (code, reason) => {
          expect(code).toBe(NO_STATUS_CODE)
          expect(reason.toString()).toBe('')
          resolve()
        })
        ctx.serverStream.destroy()
      })
    })

    it('is emitted with code 1011 and reason "stream error" on clientStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (code, reason) => {
          expect(code).toBe(INTERNAL_ERROR_CODE)
          expect(reason.toString()).toBe('stream error')
          resolve()
        })
        const error = new Error('Test error')
        ctx.clientStream.on('error', () => {})
        ctx.clientStream.destroy(error)
      })
    })

    it('is emitted with code 1011 and reason "stream error" on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (code, reason) => {
          expect(code).toBe(INTERNAL_ERROR_CODE)
          expect(reason.toString()).toBe('stream error')
          resolve()
        })
        const error = new Error('Test error')
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })

    it('is emitted with code from error.closeCode on clientStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (code) => {
          expect(code).toBe(CUSTOM_CODE)
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeCode = CUSTOM_CODE
        ctx.clientStream.on('error', () => {})
        ctx.clientStream.destroy(error)
      })
    })

    it('is emitted with code from error.closeCode on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (code) => {
          expect(code).toBe(CUSTOM_CODE)
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeCode = CUSTOM_CODE
        ctx.serverStream.on('error', () => {})
        ctx.serverStream.destroy(error)
      })
    })

    it('is emitted with reason from error.closeReason on clientStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (_code, reason) => {
          expect(reason.toString()).toBe('custom reason')
          resolve()
        })
        const error: StreamError = new Error('Test error')
        error.closeReason = 'custom reason'
        ctx.clientStream.on('error', () => {})
        ctx.clientStream.destroy(error)
      })
    })

    it('is emitted with reason from error.closeReason on serverStream.destroy(error)', async () => {
      await new Promise<void>((resolve) => {
        ctx[webSocketName].on('close', (_code, reason) => {
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
})
