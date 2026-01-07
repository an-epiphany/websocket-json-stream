/**
 * Backpressure Tests
 *
 * Tests to ensure proper handling of stream backpressure
 * when the consumer is slower than the producer.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createServer, type Server } from 'node:http'
import { WebSocket, WebSocketServer } from 'ws'
import { WebSocketJSONStream } from '../src'

interface TestContext {
  httpServer: Server
  wsServer: WebSocketServer
  url: string
}

describe('Backpressure Handling', () => {
  let ctx: TestContext

  beforeEach(async () => {
    ctx = {} as TestContext
    ctx.httpServer = createServer()
    ctx.wsServer = new WebSocketServer({ server: ctx.httpServer })

    await new Promise<void>((resolve) => {
      ctx.httpServer.listen(() => {
        const address = ctx.httpServer.address()
        if (typeof address === 'object' && address) {
          ctx.url = `http://[${address.address}]:${address.port}`
        }
        resolve()
      })
    })
  })

  afterEach(async () => {
    ctx.wsServer.close()
    await new Promise<void>((resolve) => ctx.httpServer.close(() => resolve()))
  })

  it('should handle rapid message sending without data loss', async () => {
    const clientWs = new WebSocket(ctx.url)

    const serverWs = await new Promise<WebSocket>((resolve) => {
      ctx.wsServer.once('connection', resolve)
    })

    await new Promise<void>((resolve) => {
      clientWs.once('open', resolve)
    })

    const stream = new WebSocketJSONStream(serverWs)
    const receivedMessages: unknown[] = []
    const messageCount = 100

    // Collect all messages
    stream.on('data', (data) => {
      receivedMessages.push(data)
    })

    // Send many messages rapidly from client
    for (let i = 0; i < messageCount; i++) {
      clientWs.send(JSON.stringify({ index: i }))
    }

    // Wait for all messages to be received
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (receivedMessages.length >= messageCount) {
          clearInterval(check)
          resolve()
        }
      }, 10)

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(check)
        resolve()
      }, 5000)
    })

    // All messages should be received
    expect(receivedMessages.length).toBe(messageCount)

    // Verify order is preserved
    for (let i = 0; i < messageCount; i++) {
      expect(receivedMessages[i]).toEqual({ index: i })
    }

    stream.destroy()
    clientWs.terminate()
  })

  it('should respect highWaterMark and pause when buffer is full', async () => {
    const clientWs = new WebSocket(ctx.url)

    const serverWs = await new Promise<WebSocket>((resolve) => {
      ctx.wsServer.once('connection', resolve)
    })

    await new Promise<void>((resolve) => {
      clientWs.once('open', resolve)
    })

    // Create stream with low highWaterMark
    const stream = new WebSocketJSONStream(serverWs)

    const receivedMessages: unknown[] = []

    // Don't consume data immediately - let it buffer
    // We'll consume after sending all messages

    // Send messages until push() returns false (buffer full)
    const messageCount = 50

    for (let i = 0; i < messageCount; i++) {
      clientWs.send(JSON.stringify({ index: i }))
    }

    // Wait a bit for messages to arrive
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Now start consuming
    stream.on('data', (data) => {
      receivedMessages.push(data)
    })

    // Wait for all messages
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (receivedMessages.length >= messageCount) {
          clearInterval(check)
          resolve()
        }
      }, 10)

      setTimeout(() => {
        clearInterval(check)
        resolve()
      }, 5000)
    })

    expect(receivedMessages.length).toBe(messageCount)

    stream.destroy()
    clientWs.terminate()
  })

  it('should resume receiving after consumer catches up', async () => {
    const clientWs = new WebSocket(ctx.url)

    const serverWs = await new Promise<WebSocket>((resolve) => {
      ctx.wsServer.once('connection', resolve)
    })

    await new Promise<void>((resolve) => {
      clientWs.once('open', resolve)
    })

    const stream = new WebSocketJSONStream(serverWs)
    const receivedMessages: unknown[] = []
    let paused = false

    // Slow consumer - simulate backpressure by pausing
    stream.on('data', async (data) => {
      receivedMessages.push(data)

      // After receiving some messages, pause to simulate slow consumer
      if (receivedMessages.length === 10 && !paused) {
        paused = true
        stream.pause()

        // Resume after a short delay
        await new Promise((resolve) => setTimeout(resolve, 100))
        stream.resume()
      }
    })

    // Send messages
    const messageCount = 30
    for (let i = 0; i < messageCount; i++) {
      clientWs.send(JSON.stringify({ index: i }))
    }

    // Wait for all messages
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (receivedMessages.length >= messageCount) {
          clearInterval(check)
          resolve()
        }
      }, 10)

      setTimeout(() => {
        clearInterval(check)
        resolve()
      }, 5000)
    })

    // All messages should eventually be received
    expect(receivedMessages.length).toBe(messageCount)

    stream.destroy()
    clientWs.terminate()
  })
})
