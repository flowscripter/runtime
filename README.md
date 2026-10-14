# runtime

[![version](https://img.shields.io/github/v/release/flowscripter/runtime?sort=semver)](https://github.com/flowscripter/runtime/releases)
[![build](https://img.shields.io/github/actions/workflow/status/flowscripter/runtime/release-bun-library.yml)](https://github.com/flowscripter/runtime/actions/workflows/release-bun-library.yml)
[![coverage](https://codecov.io/gh/flowscripter/runtime/graph/badge.svg?token=uWK0oWsBjr)](https://codecov.io/gh/flowscripter/runtime)
[![docs](https://img.shields.io/badge/docs-API-blue)](https://flowscripter.github.io/runtime/index.html)
[![license: MIT](https://img.shields.io/github/license/flowscripter/runtime)](https://github.com/flowscripter/runtime/blob/main/LICENSE)

> Flowscripter runtime library

> Work in progress.

## Bun Module Usage

Add the module:

`bun add @flowscripter/runtime`

Use the module:

```typescript
import { world } from "@flowscripter/runtime";

world();
```

## Development

Install dependencies:

`bun install`

Build (produces `dist/` for Node.js and TypeScript consumers; Bun uses raw source directly):

`bun run build`

Test:

`bun test`

Format:

`bunx oxfmt`

Lint:

`bunx oxlint index.ts src/ tests/`

Generate HTML API Documentation:

`bunx typedoc index.ts`

## Documentation

### Overview

Sample mermaid diagram to test rendering in markdown:

```mermaid
classDiagram
    Foo <|-- Bar
```

### API

Link to auto-generated API docs:

[API Documentation](https://flowscripter.github.io/runtime/index.html)

## License

MIT © Flowscripter
