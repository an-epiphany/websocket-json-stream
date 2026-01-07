/**
 * WebSocketJSONStream Benchmark
 *
 * Measures throughput and latency for JSON message serialization/deserialization.
 *
 * Run: npx tsx benchmark/throughput.ts
 */

import { WebSocketServer, WebSocket } from 'ws'
import { WebSocketJSONStream } from '../src'

interface BenchmarkResult {
  name: string
  messagesPerSecond: number
  avgLatencyMs: number
  minLatencyMs: number
  maxLatencyMs: number
  totalMessages: number
  durationMs: number
}

interface TestMessage {
  id: number
  timestamp: number
  payload: string
}

async function runBenchmark(
  messageCount: number,
  payloadSize: number
): Promise<BenchmarkResult> {
  return new Promise((resolve) => {
    const PORT = 9000 + Math.floor(Math.random() * 1000)
    const latencies: number[] = []
    let receivedCount = 0
    const startTime = Date.now()

    // Create payload
    const payload = 'x'.repeat(payloadSize)

    // Server
    const wss = new WebSocketServer({ port: PORT })

    wss.on('connection', (ws) => {
      const stream = new WebSocketJSONStream<TestMessage>(ws)

      stream.on('data', (msg) => {
        // Echo back immediately
        stream.write(msg)
      })
    })

    // Client
    const ws = new WebSocket(`ws://localhost:${PORT}`)
    const clientStream = new WebSocketJSONStream<TestMessage>(ws)

    clientStream.on('data', (msg) => {
      const latency = Date.now() - msg.timestamp
      latencies.push(latency)
      receivedCount++

      if (receivedCount >= messageCount) {
        const endTime = Date.now()
        const durationMs = endTime - startTime

        clientStream.end()
        wss.close()

        resolve({
          name: `${messageCount} messages, ${payloadSize}B payload`,
          messagesPerSecond: Math.round((messageCount / durationMs) * 1000),
          avgLatencyMs: Number((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)),
          minLatencyMs: Math.min(...latencies),
          maxLatencyMs: Math.max(...latencies),
          totalMessages: messageCount,
          durationMs,
        })
      }
    })

    ws.on('open', () => {
      // Send all messages
      for (let i = 0; i < messageCount; i++) {
        clientStream.write({
          id: i,
          timestamp: Date.now(),
          payload,
        })
      }
    })
  })
}

async function main() {
  console.log('WebSocketJSONStream Benchmark')
  console.log('='.repeat(60))
  console.log()

  const results: BenchmarkResult[] = []

  // Test configurations
  const configs = [
    { count: 1000, size: 100 },
    { count: 1000, size: 1000 },
    { count: 5000, size: 100 },
    { count: 5000, size: 1000 },
    { count: 10000, size: 100 },
  ]

  for (const config of configs) {
    console.log(`Running: ${config.count} messages, ${config.size}B payload...`)
    const result = await runBenchmark(config.count, config.size)
    results.push(result)
    console.log(`  -> ${result.messagesPerSecond} msg/s, avg latency: ${result.avgLatencyMs}ms`)
    console.log()
  }

  // Print summary
  console.log('='.repeat(60))
  console.log('RESULTS SUMMARY')
  console.log('='.repeat(60))
  console.log()

  console.log(
    'Test'.padEnd(35) +
    'msg/s'.padStart(10) +
    'avg(ms)'.padStart(10) +
    'min(ms)'.padStart(10) +
    'max(ms)'.padStart(10)
  )
  console.log('-'.repeat(75))

  for (const r of results) {
    console.log(
      r.name.padEnd(35) +
      r.messagesPerSecond.toString().padStart(10) +
      r.avgLatencyMs.toString().padStart(10) +
      r.minLatencyMs.toString().padStart(10) +
      r.maxLatencyMs.toString().padStart(10)
    )
  }

  console.log()
  console.log('Benchmark completed at:', new Date().toISOString())
}

main().catch(console.error)
