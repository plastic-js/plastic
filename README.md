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
- **Client-side routing** — `<Router>`, `<Route>`, `<Link>`, `navigate()`, and `<Outlet>` use the History API for static-path routing, including nested child routes.

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

## Routing

Plastic ships with a lightweight client-side router built on top of the browser History API.

### Available Router APIs

- `<Router>` owns the current location signal and listens to browser navigation.
- `<Route path="...">` renders only the active branch.
- `<Link to="...">` renders a normal anchor and intercepts internal left-click navigation.
- `navigate(to, options)` performs programmatic navigation.
- `<Outlet />` renders the currently matched child route inside a parent route component.

### Nested Routes

Nested routes are declared by placing child `<Route>` elements inside a parent `<Route>`. Parent route components render their active child branch through `<Outlet />`.

```jsx
import {
	Link,
	Outlet,
	Route,
	Router,
	navigate,
} from 'jsx'

const Settings = ()=> (
	<div>
		<h2>Settings</h2>
		<nav>
			<Link to='/settings'>Overview</Link>
			<Link to='/settings/profile'>Profile</Link>
			<Link to='/settings/security'>Security</Link>
		</nav>
		<Outlet />
	</div>
)

const SettingsOverview = ()=> <p>Overview page</p>
const SettingsProfile = ()=> <p>Profile page</p>
const SettingsSecurity = ()=> <p>Security page</p>

const App = ()=> (
	<Router>
		<Route component={Settings} path='/settings'>
			<Route index component={SettingsOverview} />
			<Route component={SettingsProfile} path='/profile' />
			<Route component={SettingsSecurity} path='/security' />
		</Route>
	</Router>
)

navigate('/settings/profile')
```

### Matching Semantics

- Leaf routes use exact static-path matching.
- Parent routes that declare child `<Route>` elements use prefix matching so they stay mounted while nested child routes switch underneath them.
- Nested child paths are resolved relative to their parent route. For example, a child `path='/profile'` inside a parent `path='/settings'` matches `/settings/profile`.
- `index` routes match the parent path itself and render through the parent component's `<Outlet />`.
