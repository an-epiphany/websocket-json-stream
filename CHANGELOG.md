# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-01-08

### ✨ Features

- **Socket.IO Adapter** - Built-in support for Socket.IO with automatic reconnection and HTTP fallback
  - New `SocketIOAdapter` class for adapting Socket.IO sockets to WebSocketLike interface
  - New `isSocketIOSocket()` type guard function for detecting Socket.IO sockets
  - New `'socketio'` adapter type for explicit Socket.IO usage
  - Auto-detection support for Socket.IO sockets in `'auto'` mode
- New `SocketIOSocket` interface exported from types

### 📖 Documentation

- Updated README with Socket.IO examples and comparison tables
- Updated Chinese README (README.zh-CN.md) with Socket.IO documentation
- Added Socket.IO server and client examples
- Updated examples/README.md with Socket.IO usage guide

### 🧪 Tests

- Added comprehensive unit tests for SocketIOAdapter
- Added Socket.IO integration tests for transport handling
- Added type detection tests for Socket.IO sockets

## [1.0.0] - 2026-01-07

Complete rewrite in TypeScript, forked from [websocket-json-stream](https://github.com/Teamwork/websocket-json-stream).

### ✨ Features

- **TypeScript First** - Complete rewrite with full type definitions and generic support
- **Dual Package** - ESM and CommonJS support with proper exports
- **SockJS Adapter** - Built-in support for SockJS with HTTP fallback transport
- **Zero Dependencies** - Only peer dependencies for WebSocket libraries
- **Type-Safe Messaging** - Generic types for compile-time message validation
- **SockJS Support** - Works with SockJS for HTTP fallback transport
- **Auto-Detection** - Automatic adapter detection for different WebSocket implementations

### 🔧 Technical Changes

- Minimum Node.js version: 18+
- Modern ES2022 target
- Built with unbuild for optimized dual package output
- Comprehensive test suite with Vitest
- Benchmark tooling included

### 📦 Package

- Published as `@an-epiphany/websocket-json-stream`
- MIT License
