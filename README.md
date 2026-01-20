# JSX Framework

A lightweight, reactive web frontend framework that uses JSX syntax without Virtual DOM. Built on top of [alien-signals](https://github.com/stackblitz/alien-signals) for fine-grained reactivity.

## Features

- **No Virtual DOM**: Direct DOM manipulation for better performance
- **Fine-grained Reactivity**: Powered by alien-signals
- **JSX Support**: Write components using familiar JSX syntax
- **Zero Dependencies**: Only one runtime dependency (alien-signals)
- **Lightweight**: Minimal framework overhead

## Installation

```bash
npm install
```

## Quick Start

```bash
# Development
npm run dev

# Build
npm run build

# Preview
npm run preview
```

## Core Concepts

### Reactive State

Use `signal` for reactive state and `computed` for derived values:

```jsx
import { signal, computed } from './jsx-runtime.js'

const count = signal(0)
const doubled = computed(() => count() * 2)
```

### Components

Components are simple functions that return JSX:

```jsx
const Label = (props) => {
  return <label>{props.text}</label>
}
```

### Event Handling

Event handlers are passed as props with `on` prefix:

```jsx
<button onClick={() => count(count() + 1)}>
  Increment
</button>
```

### Reactive Rendering

Reactive values automatically update the DOM when changed:

```jsx
<p>Count: {count}</p>
<p>Doubled: {doubled}</p>
```

## Example

```jsx
import { signal, computed } from './jsx-runtime.js'

const count = signal(0)
const doubled = computed(() => count() * 2)

const App = () => (
  <div>
    <p>Count: {count}</p>
    <p>Doubled: {doubled}</p>
    <button onClick={() => count(count() + 1)}>
      Increment
    </button>
  </div>
)

export default App
```

## How It Works

1. **JSX Compilation**: Vite + Babel transforms JSX into `h()` function calls
2. **Element Creation**: The `h()` function creates real DOM elements
3. **Reactivity**: alien-signals tracks dependencies and updates DOM directly
4. **No Diffing**: Changes are applied immediately to specific DOM nodes

## Tech Stack

- **Runtime**: alien-signals (reactive primitives)
- **Build Tool**: Vite
- **Transpiler**: Babel with React preset
- **Linter**: ESLint

## License

ISC
