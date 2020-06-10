# ts-template
[![license](https://img.shields.io/github/license/flowscripter/ts-template.svg)](https://github.com/flowscripter/ts-template/blob/master/LICENSE)
[![dependencies](https://img.shields.io/david/flowscripter/ts-template.svg)](https://david-dm.org/flowscripter/ts-template)
[![travis](https://api.travis-ci.com/flowscripter/ts-template.svg)](https://travis-ci.com/flowscripter/ts-template)
[![coverage](https://sonarcloud.io/api/project_badges/measure?project=flowscripter_ts-template&metric=coverage)](https://sonarcloud.io/dashboard?id=flowscripter_ts-template)
[![npm](https://img.shields.io/npm/v/@flowscripter/ts-template.svg)](https://www.npmjs.com/package/@flowscripter/ts-template)

> Template TypeScript library project.

## Usage

1. Export and expand a zip of this repository.
1. Update links and references in `README.md`.
1. Update links and references in `package.json`.
1. Update links and references in `gulpfile.js`

## Overview

#### Entry Points for Node and Browser

The build config in `rollup.config.js` produces two bundled entry points:

* `node.js` is intended for consumption in node and exposed via the `main` property in `package.json`.
* `browser.js` - is intended for consumption in a browser and exposed via the `browser` property in `package.json`.

This ensures that dependencies for node specific modules can be shimmed via [rollup-plugin-node-builtins](https://github.com/calvinmetcalf/rollup-plugin-node-builtins)

#### Configuration
Explanation of project configuration files:

* `.editorconfig` - Configures [EditorConfig](https://editorconfig.org) compliant editors
* `.eslintrc.json` - TypeScript based [ESLint](https://eslint.org) configuration for the project derived from [@flowscripter/eslint-config](https://www.npmjs.com/package/@flowscripter/eslint-config)
* `.gitignore` - Specifies files for git to [ignore](https://git-scm.com/docs/gitignore)
* `.huskyrc.json` - Provides git hooks using [Husky](https://github.com/typicode/husky) to enforce semantic commit messages, linting and unit testing.
* `.travis.yml` - Defines the [Travis](https://travis-ci.com) build pipeline.
* `.commitlintrc.json` - Configures [commitlint](https://conventional-changelog.github.io/commitlint) to ensure commit messages can be used to drive automated [Semantic Version](https://semver.org) releases.
* `gulpfile.cjs` - Invoked during the Travis build to run [Sonarqube-scanner](https://github.com/bellingard/sonar-scanner-npm)
* `jest.config.json` - Configures the unit testing framework [Jest](https://jestjs.io) for TypeScript and coverage reports.
* `package.json` - Defines development cycle scripts and configures publication of ES2015 modules.
* `.releaserc.json` - Configuration for automated semantic version releasing using [semantic-release](https://semantic-release.gitbook.io/semantic-release/)
* `renovate.json` - Ensures automated dependency upgrade via [Renovate](https://renovatebot.com) using a config derived from [@flowscripter/renovate-config](https://www.npmjs.com/package/@flowscripter/renovate-config)
* `rollup.config.js` - Defines the TypeScript and ES2015 module build pipeline for [Rollup](https://rollupjs.org/guide/en)
* `tsconfig.json` - [TypeScript](https://www.typescriptlang.org) configuration for the project derived from [@flowscripter/tsconfig](https://www.npmjs.com/package/@flowscripter/tsconfig)
* `typedoc.json` - Configuration of [TypeDoc](https://typedoc.org) API document generation

#### No Legacy JavaScript Support

All source and build output is in ES2015 module form.

Browsers or NodeJS versions need to support:

* https://github.com/tc39/proposal-dynamic-import
* https://tc39.github.io/ecmascript-asyncawait/
* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions

Because of this the modules are configured so that:

* no transpiling is performed (apart from TypeScript to ES2015 JavaScript)
* `package.json` specifies:
    * `"main": "dist/index.js`
    * `"type": "module"`
    * `"node": ">=14.4.0"`

#### Legacy Module Consumption

Legacy CommonJS format npm packages are supported for internal consumption by `rollup-plugin-commonjs`

#### External Dependencies

The module is generated without the `debug` dependency being included. This is achieved by:

* Specifying `debug` as a peer dependency in `package.json`
* Using the `rollup-plugin-peer-deps-external` plugin for Rollup.

This allows consuming applications to determine the best form of the dependency (e.g. NodeJS or browser version)
and ensures it will only be added once to the final consuming application module.

#### Consuming Browser Application

For a consuming browser application, the library modules are consumed by providing replacements for NodeJS packages
such as `tty` and `util` via the following Rollup plugins:

* `rollup-plugin-node-builtins`
* `rollup-plugin-node-globals`

#### Consuming NodeJS Application

For the consuming node application the library modules are consumed by declaring NodeJS packages
such as `tty` and `util` as being externally available via the following Rollup config:

```
    external: [
        'tty',
        'util',
        'os'
    ]
```

## API

[API documentation](https://flowscripter.github.io/ts-template)

## Development

Firstly:

```
npm install
```

then:

Build: `npm run build`

Watch: `npm run watch`

Test: `npm test`

Lint: `npm run lint`

Docs: `npm run docs`

## License

MIT © Flowscripter
