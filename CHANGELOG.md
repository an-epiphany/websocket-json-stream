# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-07

Complete rewrite in TypeScript, forked from [websocket-json-stream](https://github.com/Teamwork/websocket-json-stream).

### ✨ Features

- **TypeScript First** - Complete rewrite with full type definitions and generic support
- **Dual Package** - ESM and CommonJS support with proper exports
- **SockJS Adapter** - Built-in support for SockJS with HTTP fallback transport
- **Zero Dependencies** - Only peer dependencies for WebSocket libraries
- **Type-Safe Messaging** - Generic types for compile-time message validation
- **Browser WebSocket Support** - Works with native browser WebSocket API
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
