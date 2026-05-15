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
- **Client-side routing** — `<Router>`, `<Route>`, `<Link>`, `<NavLink>`, `navigate()`, `<Outlet>`, and `useRoute()` use the History API for nested routing with params and query awareness.

## Props Model and One-Way Data Flow

Plastic enforces a strict one-way data flow contract: data travels **downward** from parent to child through props, and upward only through explicit callbacks or shared reactive state. A child component must never mutate its own props.

### Read-Only Props Proxy

When a JSX element carries any attributes or children, the Babel plugin compiles all props into a single `mergeProps(...)` call. The result is a read-only Proxy — any attempt to write a prop throws immediately:

```js
const Child = (props) => {
    props.label = 'override'  // Error: mergeProps result is read-only
}
```

This turns a common accidental mistake into an explicit runtime error instead of a silent data corruption.

### How Reactive Props Work

Dynamic attribute expressions are compiled into getter properties so that reading a prop inside a reactive binding effect automatically subscribes to its signal dependencies:

```jsx
// Source
<MyComp foo={2} bar={state.b}>{kid}</MyComp>

// Compiled
jsx(MyComp, mergeProps({
    foo: 2,
    get bar() { return state.b },
    get children() { return kid },
}))
```

Reading `props.bar` inside an effect invokes the getter, which reads `state.b` and registers a subscription. When `state.b` changes, only the binding that reads `props.bar` re-executes — no component re-render, no diffing.

### Dynamic Spread Sources

Spread attributes whose value is a dynamic expression (a call, a member access, etc.) are wrapped in a thunk argument to `mergeProps` so that the spread source is re-evaluated lazily on each reactive read:

```jsx
// Source
<MyComp {...api()} foo={2} bar={state.b} />

// Compiled
jsx(MyComp, mergeProps(
    () => api(),
    { foo: 2, get bar() { return state.b } },
))
```

Signal reads inside `api()` are tracked by the same binding effect that reads the resulting prop, so changes inside `api()` automatically propagate to the DOM without any extra wiring.

### `mergeProps` vs. Solid's Implementation

Plastic's `mergeProps` shares the same surface API as Solid's but differs in three important ways:

- **Always a Proxy.** Solid returns a plain `{}` for static plain-object sources to avoid Proxy overhead. Plastic always returns a Proxy.
- **Thunk-based reactivity, not `createMemo`.** Solid wraps function sources in `createMemo` during initialisation so they are only re-executed when their signals change. Plastic calls the function on every property access; signal tracking still works, but there is no memoisation between reads.
- **Special-key merging.** Plastic adds merging semantics for four key families that Solid does not have:

| Key | Plastic behaviour |
|---|---|
| `class` / `className` | treated as one family; all string values concatenated with a space |
| `style` | plain objects shallow-merged; strings joined with `; ` |
| `ref` | last source wins (matches Solid) |
| `onXxx` event handlers | last source wins (matches Solid) |

`class` and `style` receive additive merging so host components can contribute tokens and styles alongside the consumer's without clobbering. `ref` and `onXxx` follow Solid's last-wins rule.

## Lifecycle Semantics

- `onMount` callbacks run in **child-first** order for nested component trees.
- Component unmount also follows **child-first** order.
- During unmount, owner-scoped `effects` are stopped before owner cleanups are flushed, so reactive subscriptions and event bindings are disposed predictably.

## Current Runtime Coverage

- **Reactive DOM props**: signals, computed values, and getter sources can drive common DOM props (for example `value`, `title`, `disabled`, `placeholder`) through a shared binding path.
- **Reactive `className`**: class tokens are added and removed incrementally so stale class names are cleaned up when state changes.
- **Reactive `style` object**: style keys are diffed by key; removed keys are cleared from the element to avoid stale inline styles.
- **Event binding is one-time**: intrinsic `onXxx` props are bound as plain handlers when the node mounts. The reactive Babel transform intentionally does not wrap event expressions into thunks, so patterns like `onClick={flag() ? fnA : fnB}` do not rebind when `flag` changes.
- **JSX-to-DOM prop normalization**: camelCase JSX props like `autoFocus`, `autoComplete`, `autoPlay`, `encType`, and `hrefLang` are normalized to the browser-exposed DOM keys before apply.
- **Mount/dispose API**: `renderApp(container, node)` returns an idempotent disposer that unmounts DOM and disposes owner/effect scopes.
- **Lifecycle hooks**: `onMount` and cleanup registration (`onCleanup` wrapper) are available for component-level setup and teardown.

## Reactivity

Plastic's reactivity layer is built on top of [alien-signals](https://github.com/stackblitz/alien-signals) and extends it with deep object reactivity. All primitives are exported from `jsx`.

### Primitives

#### `createSignal(initialValue)`

Creates a reactive container for a single value. Reading the signal inside an `effect` or `createComputed` subscribes to it; writing triggers updates.

```js
import { createSignal, effect } from 'jsx'

const count = createSignal(0)
effect(() => console.log(count()))  // logs 0
count(1)                             // logs 1
```

Passing an existing signal returns it unchanged — double-wrapping is a no-op.

#### `createComputed(fn)`

Creates a lazily-evaluated derived value. The computation re-runs only when its signal dependencies change.

```js
import { createSignal, createComputed } from 'jsx'

const firstName = createSignal('Jane')
const lastName  = createSignal('Doe')
const fullName  = createComputed(() => `${firstName()} ${lastName()}`)

fullName()  // 'Jane Doe'
```

#### `createTree(obj)`

Wraps a plain object (or array) in a deep-reactive Proxy, equivalent to Vue 3's `reactive()`. Every property read subscribes to that property's signal; every write triggers only the affected property's subscribers.

```js
import { createTree, effect } from 'jsx'

const state = createTree({ user: { name: 'Alice' }, count: 0 })

effect(() => console.log(state.user.name))  // logs 'Alice'
state.user.name = 'Bob'                      // logs 'Bob'
```

Nested objects are wrapped on demand when accessed, so reactivity is deep without upfront cost. Calling `createTree` on an already-reactive tree is a no-op.

#### `effect(fn)`

Runs `fn` immediately and re-runs it whenever any signal read inside it changes.

```js
import { createSignal, effect } from 'jsx'

const x = createSignal(1)
effect(() => console.log('x is', x()))
x(2)  // logs 'x is 2'
```

Effects are automatically disposed when their owner scope is cleaned up (for example, when a component unmounts).

#### `batch(fn)`

Defers all signal notifications until `fn` returns, so multiple writes trigger only one downstream update.

```js
import { createSignal, createComputed, batch } from 'jsx'

const a = createSignal(1)
const b = createSignal(2)
const sum = createComputed(() => a() + b())

batch(() => {
    a(10)
    b(20)
})
// sum re-computes once, not twice
```

### Nesting Rules

| Combination | Allowed | Notes |
|---|---|---|
| `signal → primitive` | Yes | Normal usage |
| `signal → tree` | Yes | Signal controls which object; tree tracks its properties |
| `signal → function` | Yes | Signal controls which computation to use |
| `signal → signal` | No | Forbidden — `createSignal` returns the inner signal as-is |
| `signal → computed` | Discouraged | Triggers a runtime warning; use the computed directly |

### Utility Functions

- **`isSignal(value)`** — returns `true` if `value` is a signal.
- **`isComputed(value)`** — returns `true` if `value` is a computed.
- **`isTree(value)`** — returns `true` if `value` is a reactive tree proxy.
- **`toRaw(value)`** — unwraps a reactive tree proxy to its underlying plain object. Safe to call on non-proxy values (returns the value unchanged).
- **`runUntracked(fn)`** — runs `fn` without registering any signal subscriptions. Useful when reading reactive state for a one-off value without creating a dependency.

```js
import { createTree, toRaw, isTree } from 'jsx'

const state = createTree({ x: 1 })
isTree(state)   // true
toRaw(state)    // { x: 1 }
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

## Routing

Plastic ships with a lightweight client-side router built on top of the browser History API.

Hash-based routing is intentionally not supported at the moment. To keep the router implementation small and predictable, Plastic currently supports only the History API.

### Available Router APIs

- `<Router>` owns the current location signal and listens to browser navigation.
- `<Route path="...">` renders only the active branch.
- `<Link to="...">` renders a normal anchor and intercepts internal left-click navigation.
- `<NavLink to="...">` extends `<Link>` and adds an `active` class plus `aria-current="page"` when the target matches the current route.
- `useMatch(path)` returns a reactive matcher function for custom active-state UI without rendering `<NavLink>`.
- `navigate(to, options)` performs programmatic navigation.
- `<Outlet />` renders the currently matched child route inside a parent route component.
- `lazy(importFn, options?)` wraps a dynamic import as a code-split component for use with `<Route>`.

### Active Navigation Links

Use `<NavLink>` when a navigation item should reflect the current route automatically.

```jsx
import { NavLink, Route, Router } from 'jsx'

const App = ()=> (
	<Router>
		<nav>
			<NavLink to='/'>Home</NavLink>
			<NavLink to='/settings' className='nav-item'>Settings</NavLink>
		</nav>

		<Route path='/' component={HomePage} />
		<Route path='/settings' component={SettingsPage} />
	</Router>
)
```

By default, `NavLink` treats nested URLs as active matches, so a link to `/settings` stays active on `/settings/profile`. Pass `end` to require an exact pathname match instead. Use `activeClass` to override the default `active` class name.

### Custom Match Hook

Use `useMatch(path)` when you want route-aware active styles on non-anchor UI (tabs, cards, badges, etc.).

```jsx
import { Router, Route, useMatch } from 'jsx'

const DashboardTabs = ()=> {
	const isSettings = useMatch('/settings')
	const isUser = useMatch('/users/:id')

	return (
		<div>
			<p className={isSettings() ? 'on' : 'off'}>Settings</p>
			<p className={isUser() ? 'on' : 'off'}>User</p>
		</div>
	)
}

const App = ()=> (
	<Router>
		<Route path='*' component={DashboardTabs} />
	</Router>
)
```

`useMatch('/settings')` follows `NavLink` default active behavior (prefix match), while parameterized paths like `/users/:id` use exact segment-shape matching.

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

- Leaf routes use exact path-shape matching (including `:param` segments).
- Parent routes that declare child `<Route>` elements use prefix matching so they stay mounted while nested child routes switch underneath them.
- Nested child paths are resolved relative to their parent route. For example, a child `path='/profile'` inside a parent `path='/settings'` matches `/settings/profile`.
- `index` routes match the parent path itself and render through the parent component's `<Outlet />`.
- Query strings are exposed through `useRoute().query` and route props (`query`) without affecting path matching.

### Lazy Loading

`lazy(importFn, options?)` code-splits a route component via a dynamic `import()`. The module is fetched the first time the route is rendered; subsequent renders reuse the cached result synchronously. Because the resolved component is stored in a signal, the route automatically re-renders once the import settles — no manual wiring required.

```jsx
import { lazy, Route, Router } from 'jsx'

// Each call to lazy() creates an independent, deduplicated import.
const LazyDashboard = lazy(() => import('./pages/Dashboard.jsx'))
const LazySettings  = lazy(() => import('./pages/Settings.jsx'))

const App = ()=> (
	<Router>
		<Route component={LazyDashboard} path='/dashboard' />
		<Route component={LazySettings}  path='/settings' />
	</Router>
)
```

**With a loading fallback**

Pass a `fallback` option to render a placeholder component while the import is in flight:

```jsx
const Spinner = ()=> <p>Loading…</p>

const LazyDashboard = lazy(
	()=> import('./pages/Dashboard.jsx'),
	{ fallback: Spinner },
)
```

`fallback` can be a component function (called with no props) or a pre-created DOM node / `null`. When omitted, the route renders nothing during loading.

**API**

| Argument | Type | Description |
|---|---|---|
| `importFn` | `() => Promise<module>` | Zero-argument factory. The module's `default` export is used as the component. |
| `options.fallback` | `Component \| Node \| null` | Shown while the import is in flight. Defaults to `null`. |

> The returned `LazyComponent` function is a plain component and can also be used outside of routes — anywhere `h(LazyComponent, props)` is valid.
