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
import { createRuntime } from "@flowscripter/runtime";

const runtime = createRuntime({
  config: { logLevel: "info", components: { myComponent: { retries: 3 } } },
  logger, // optional: a plugin-api Logger
  output, // optional: a plugin-api Output
  onProgress: (event) => {},
  onMetric: (event) => {},
});

runtime.updateConfig({ logLevel: "debug" });
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

`createRuntime(options)` returns an independent runtime instance with no module-level state and no platform-specific imports, so it runs under Bun and in browsers. The host supplies an already parsed config object and the `Logger`, `Output`, progress and metric sinks defined in `@flowscripter/plugin-api`.

- Log level comes from `config.logLevel` (`debug`, `info`, `warn`, `error`, `silent`; default `info`) and is applied by the runtime before the host logger is called.
- `updateConfig` replaces the whole config. Listeners registered with `onConfigChange` receive the new and previous config, and only when something changed.
- Component config is returned opaque by `getComponentConfig(handle)`; each component validates its own config.
- Unknown top-level config keys are ignored with a single warning.
- Failures in host supplied loggers, outputs, callbacks and listeners never propagate to the caller.
- `runtime.context` is the `RuntimeContext` passed to components. Each runtime owns in-memory defaults for the registry, datastore manager, session manager and session; nothing is shared between runtimes.
- The built-in in-memory datastore has the handle `memory` and the session has the handle `default`. A `session` option is adopted as the `default` session.
- `registerComponent(handle, component, kind)` (`kind` is `datastore` or `dataModel`) and `unregisterComponent(handle)` feed the registry. Handles must be non-empty and unique; duplicates throw.
- `dispose()` returns a promise. Registered components are disposed in reverse registration order, errors from `dispose()` are logged and do not stop the others, then logging and output are silenced.

### API

Link to auto-generated API docs:

[API Documentation](https://flowscripter.github.io/runtime/index.html)

## License

MIT © Flowscripter
