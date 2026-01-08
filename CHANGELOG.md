# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-01-08

### ✨ Features

- **Custom Serializer** - Pluggable serialization support for better performance or different formats
  - New `Serializer<T>` interface with `serialize` and `deserialize` methods
  - New `WebSocketJSONStreamOptions<T>` interface for options-based constructor
  - New `jsonSerializer` export as the default JSON serializer
  - Support for MessagePack, Base64, and other custom serialization formats
  - Full backward compatibility with legacy constructor signature

### 📖 Documentation

- Updated README with Custom Serializer section and examples
- Added MessagePack and Base64 encoding examples
- Updated API Reference with new options-based constructor
- Updated Types section with new interfaces
- Updated Chinese README (README.zh-CN.md) with all changes

### 🧪 Tests

- Added comprehensive custom serializer test suite (15 tests)
  - Default jsonSerializer tests
  - Options object constructor tests
  - Backward compatibility tests
  - Send/receive with custom serializer tests
  - Bidirectional Base64 encoding tests
  - Error handling tests (serialize/deserialize failures)
  - Type safety tests

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
