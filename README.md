# JSX with Reactive Signals

A minimal JSX implementation that transpiles JSX syntax into vanilla JavaScript with built-in **reactivity** using [alien-signals](https://github.com/stackblitz/alien-signals).

## Overview

This project demonstrates how JSX works at its core and combines it with a modern reactive system. It uses:
- Custom `h()` function (hyperscript) for DOM creation
- **alien-signals** for reactive state management
- Automatic DOM updates when reactive state changes

## Project Structure

- **[app.jsx](app.jsx)** - Source file with JSX syntax and reactive code
- **[app.js](app.js)** - Transpiled JavaScript output
- **[jsx-runtime.js](jsx-runtime.js)** - Custom JSX runtime with `h()` function and reactivity support
- **[index.html](index.html)** - Demo HTML page
- **[.babelrc](.babelrc)** - Babel configuration for JSX transpilation
- **[package.json](package.json)** - Project dependencies and scripts

## How It Works

### Reactive State with Signals

The `h()` function now integrates with **alien-signals** to create reactive components:

```javascript
import { signal, computed, h } from './jsx-runtime.js';

// Create reactive state
const count = signal(0);
const doubleCount = computed(() => count() * 2);

// Use in JSX - wrap signal getters in arrow functions
const App = () => (
  <div>
    <p>Count: {() => count()}</p>
    <p>Double: {() => doubleCount()}</p>
    <button onClick={() => count(count() + 1)}>+</button>
  </div>
);
```

### Custom `h()` Function

The [`h()`](jsx-runtime.js) function now supports:
- **Reactive state** - Signal values automatically update the DOM
- **Computed values** - Derived reactive state
- **Event listeners** - Props starting with `on` bind to events
- **Attributes** - HTML attributes on elements
- **Children** - Text nodes and nested elements

### Key Features

1. **Signal Support**: Wrap signal getters in arrow functions `() => signal()`
2. **Automatic Updates**: DOM updates automatically when signals change
3. **Computed Values**: Derived signals that automatically track dependencies
4. **Effects**: Run side effects when reactive state changes
5. **Zero Framework Overhead**: Just plain JavaScript and vanilla DOM APIs

## Setup

### Install Dependencies

```bash
npm install
```

### Transpile JSX to JavaScript

```bash
npx babel app.jsx -o app.js
```

Then open `index.html` in a browser or serve with a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using Node.js (simple server)
node -e "require('http').createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); require('fs').createReadStream('./' + (req.url === '/' ? 'index.html' : req.url.slice(1))).pipe(res); }).listen(8000)"
```

Then navigate to `http://localhost:8000`

## Example Usage

```javascript
import { signal, computed, h } from './jsx-runtime.js';

// Create reactive state
const count = signal(0);
const isHigh = computed(() => count() > 5);

const App = () => (
  <div className="app">
    <h1>Counter App</h1>
    
    {/* Signal values must be wrapped in arrow functions */}
    <p>Current count: {() => count()}</p>
    <p>Is high: {() => isHigh() ? 'Yes!' : 'No'}</p>
    
    {/* Event handlers work normally */}
    <button onClick={() => count(count() + 1)}>Increment</button>
    <button onClick={() => count(0)}>Reset</button>
  </div>
);

document.body.appendChild(App());
```

## Alien Signals API

### signal(initialValue)
Creates a reactive value that can be read and written:
```javascript
const count = signal(0);
count();        // Read value
count(1);       // Write value
```

### computed(fn)
Creates a derived reactive value:
```javascript
const doubled = computed(() => count() * 2);
doubled();      // Returns computed result
```

### effect(fn)
Runs code whenever dependencies change:
```javascript
effect(() => {
  console.log(`Count is now ${count()}`);
});
```

## Features

- ✨ Zero framework overhead - vanilla JavaScript
- ⚡ Minimal reactive system - just signals and effects
- 🎯 Automatic DOM updates when state changes
- 🔄 Computed values with automatic dependency tracking
- 📦 No build step required for the runtime (only Babel for JSX transpilation)
- 🌈 Beautiful example with counter demo

## Browser Support

Works in all modern browsers that support:
- ES6 modules
- `document.createElement`
- `MutationObserver` (implicitly used by alien-signals)

## Further Learning

- [alien-signals Repository](https://github.com/stackblitz/alien-signals)
- [Babel JSX Plugin](https://babeljs.io/docs/babel-plugin-transform-react-jsx)
- [MDN - DOM API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model)

## License

ISC