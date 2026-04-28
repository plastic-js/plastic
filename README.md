# Plastic

A lightweight custom JSX runtime that works as a web front-end framework. Inspired by the principles of [Solid.js](https://www.solidjs.com/), Plastic skips the Virtual DOM entirely and instead creates real DOM nodes directly, with fine-grained reactivity driven by [alien-signals](https://github.com/stackblitz/alien-signals).

## Scope

- **Client-side only (CSR)** — Plastic is designed for browser runtime usage and does **not** include or plan Server-Side Rendering (SSR) support.

## Features

- **No Virtual DOM** — JSX compiles directly to DOM creation calls; no diffing, no reconciliation overhead.
- **Fine-grained reactivity** — powered by `alien-signals` (`signal`, `computed`, `effect`).
- **Familiar JSX syntax** — drop-in JSX transform compatible with Vite and Babel.
- **Event binding** — `onXxx` props map to `addEventListener` automatically.
- **Style objects** — pass a plain object to the `style` prop, including CSS custom properties.
- **Fragment support** — return multiple root nodes without a wrapper element.
- **`<Either>` conditional rendering** — lazily renders only the active branch (`<True>`/`<False>`) via a comment-node anchor; inactive branches are never evaluated until the condition flips.
- **`<Loop>` list rendering** — reconciles lists by object identity; reuses, moves, and disposes item rows with fine-grained owner tracking.

## Lifecycle Semantics

- `onMount` callbacks run in **child-first** order for nested component trees.
- Component unmount also follows **child-first** order.
- During unmount, owner-scoped `effects` are stopped before owner cleanups are flushed, so reactive subscriptions and event bindings are disposed predictably.

## Current Runtime Coverage

- **Reactive DOM props**: signals, computed values, and getter sources can drive common DOM props (for example `value`, `title`, `disabled`, `placeholder`) through a shared binding path.
- **Reactive `className`**: class tokens are added and removed incrementally so stale class names are cleaned up when state changes.
- **Reactive `style` object**: style keys are diffed by key; removed keys are cleared from the element to avoid stale inline styles.
- **JSX-to-DOM prop normalization**: camelCase JSX props like `autoFocus`, `autoComplete`, `autoPlay`, `encType`, and `hrefLang` are normalized to the browser-exposed DOM keys before apply.
- **Mount/dispose API**: `renderApp(container, node)` returns an idempotent disposer that unmounts DOM and disposes owner/effect scopes.
- **Lifecycle hooks**: `onMount` and cleanup registration (`onCleanup` wrapper) are available for component-level setup and teardown.

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

