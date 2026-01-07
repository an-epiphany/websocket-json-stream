import { Duplex, DuplexOptions } from 'node:stream'
import { adaptWebSocket, type AdaptableWebSocket, type AdapterType } from './adapters'

/** WebSocket ready states */
const enum ReadyState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

/** WebSocket close codes */
const NORMAL_CLOSURE_CODE = 1000
const NORMAL_CLOSURE_REASON = 'stream end'
const INTERNAL_ERROR_CODE = 1011
const INTERNAL_ERROR_REASON = 'stream error'

/**
 * Minimal WebSocket interface compatible with both browser WebSocket and ws library
 */
export interface WebSocketLike {
  readonly readyState: number
  send(data: string, callback?: (error?: Error) => void): void
  close(code?: number, reason?: string): void
  addEventListener(type: 'message', listener: (event: { data: string }) => void): void
  addEventListener(type: 'open' | 'close', listener: () => void): void
  removeEventListener(type: 'message', listener: (event: { data: string }) => void): void
  removeEventListener(type: 'open' | 'close', listener: () => void): void
}

/**
 * Extended error interface with optional WebSocket close code and reason
 */
export interface StreamError extends Error {
  closeCode?: number
  closeReason?: string
}

type WriteCallback = (error?: Error | null) => void

/**
 * A Duplex stream that wraps a WebSocket connection and handles JSON serialization.
 *
 * @example
 * ```typescript
 * import { WebSocketJSONStream } from 'websocket-json-stream'
 * import { WebSocket } from 'ws'
 *
 * const ws = new WebSocket('ws://localhost:8080')
 * const stream = new WebSocketJSONStream(ws)
 *
 * stream.on('data', (data) => {
 *   console.log('Received:', data)
 * })
 *
 * stream.write({ message: 'Hello' })
 * ```
 */
export class WebSocketJSONStream<T = unknown> extends Duplex {
  private _emittedClose = false
  private _ending = false
  public readonly ws: WebSocketLike

  constructor(ws: AdaptableWebSocket, adapterType: AdapterType = 'ws') {
    const options: DuplexOptions = {
      objectMode: true,
      allowHalfOpen: false,
      emitClose: false,
    }
    super(options)

    this.ws = adaptWebSocket(ws, adapterType)

    this.ws.addEventListener('message', ({ data }) => {
      let value: T

      try {
        value = JSON.parse(data) as T
      } catch (error) {
        this.destroy(error as Error)
        return
      }

      if (value == null) {
        this.destroy(new Error("Can't JSON.parse the value"))
        return
      }

      this.push(value)
    })

    this.ws.addEventListener('close', () => {
      // Don't call destroy() if we're already ending via _final
      if (!this._ending) {
        this.destroy()
      }
    })
  }

  override _read(): void {
    // Data is pushed via the 'message' event listener
  }

  override _write(object: T, _encoding: BufferEncoding, callback: WriteCallback): void {
    let json: string

    try {
      json = JSON.stringify(object)
    } catch (error) {
      callback(error as Error)
      return
    }

    if (typeof json !== 'string') {
      callback(new Error("Can't JSON.stringify the value"))
      return
    }

    this._send(json, callback)
  }

  private _send(json: string, callback: WriteCallback): void {
    if (this.ws.readyState === ReadyState.CONNECTING) {
      const send = (): void => {
        this.ws.removeEventListener('open', send)
        this.ws.removeEventListener('close', send)
        this._send(json, callback)
      }
      this.ws.addEventListener('open', send)
      this.ws.addEventListener('close', send)
    } else if (this.ws.readyState === ReadyState.OPEN) {
      this.ws.send(json, callback)
    } else {
      const error = new Error('WebSocket CLOSING or CLOSED.') as StreamError
      error.name = 'Error [ERR_CLOSED]'
      callback(error)
    }
  }

  override _final(callback: WriteCallback): void {
    /*
     * 1000 indicates a normal closure, meaning that the purpose for which
     * the connection was established has been fulfilled.
     * https://tools.ietf.org/html/rfc6455#section-7.4.1
     */
    this._ending = true
    this._closeWebSocket(NORMAL_CLOSURE_CODE, NORMAL_CLOSURE_REASON, callback)
  }

  override _destroy(error: StreamError | null, callback: WriteCallback): void {
    /*
     * Calling destroy without an error object will close the stream
     * without a code. This results in the client emitting a CloseEvent
     * that has code 1005.
     *
     * 1005 is a reserved value and MUST NOT be set as a status code in a
     * Close control frame by an endpoint. It is designated for use in
     * applications expecting a status code to indicate that no status
     * code was actually present.
     * https://tools.ietf.org/html/rfc6455#section-7.4.1
     */
    let code: number | undefined
    let reason: string | undefined

    if (error) {
      /*
       * 1011 indicates that a remote endpoint is terminating the
       * connection because it encountered an unexpected condition that
       * prevented it from fulfilling the request.
       * http://www.rfc-editor.org/errata_search.php?eid=3227
       */
      code = error.closeCode ?? INTERNAL_ERROR_CODE
      reason = error.closeReason ?? INTERNAL_ERROR_REASON
    }

    this._closeWebSocket(code, reason, () => callback(error))
  }

  private _closeWebSocket(
    code: number | undefined,
    reason: string | undefined,
    callback: WriteCallback
  ): void {
    switch (this.ws.readyState) {
      case ReadyState.CONNECTING: {
        const close = (): void => {
          this.ws.removeEventListener('open', close)
          this.ws.removeEventListener('close', close)
          this._closeWebSocket(code, reason, callback)
        }
        this.ws.addEventListener('open', close)
        this.ws.addEventListener('close', close)
        break
      }
      case ReadyState.OPEN: {
        const closed = (): void => {
          this.ws.removeEventListener('close', closed)
          this._closeWebSocket(code, reason, callback)
        }
        this.ws.addEventListener('close', closed)
        this.ws.close(code, reason)
        break
      }
      case ReadyState.CLOSING: {
        const closed = (): void => {
          this.ws.removeEventListener('close', closed)
          this._closeWebSocket(code, reason, callback)
        }
        this.ws.addEventListener('close', closed)
        break
      }
      case ReadyState.CLOSED: {
        process.nextTick(() => {
          // Call callback first to allow 'finish' event to fire before 'close'
          callback()
          if (!this._emittedClose) {
            this._emittedClose = true
            this.emit('close')
          }
        })
        break
      }
      default: {
        process.nextTick(() => {
          callback(new Error(`Unexpected readyState: ${this.ws.readyState}`))
        })
        break
      }
    }
  }
}
