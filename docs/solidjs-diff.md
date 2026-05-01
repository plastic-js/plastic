# Plastic vs Solid.js: Feature and API Differences (Component Library Focus)

> Updated: 2026-05-01  
> Scope: currently implemented capabilities in this repository (validated from src and test behavior)

## 1. Purpose of This Document

This document is intended as a decision guide for component library development:

- Clarify differences between Plastic's currently implemented capabilities and Solid.js
- Identify what can be reused from Solid design patterns and what cannot be copied directly
- Reduce adaptation cost and avoid repeated rework caused by API semantic mismatches

## 2. Executive Summary

Plastic follows the same direction as Solid.js (no Virtual DOM + fine-grained reactivity), but it is currently a lighter, runtime-minimal implementation:

- Covered: core reactivity, JSX rendering, basic lifecycle, context, control flow, CSR routing
- Not covered: SSR/Hydration, Suspense/Resource, error boundaries, scheduling/concurrency helpers, many Solid ecosystem APIs
- Most important semantic differences: signal shape, event binding strategy, classList support, control-flow naming/compile conventions

## 3. High-Frequency API Comparison

| Area | Solid.js | Plastic Current Status | Difference |
|---|---|---|---|
| Signal | `const [v, setV] = createSignal()` | `const v = createSignal()` | Plastic uses a single-function read/write model (`v()` read, `v(next)` write), not tuple style. |
| Effect | `createEffect` | `createEffect` (alias exported from `createBindingEffect`) | Similar baseline effect behavior, but no full Solid scheduling toolbox (for example `batch`/`untrack`/`startTransition`). |
| Memo/Computed | `createMemo` | `createComputed` | Different naming and ergonomics; current implementation is based on `alien-signals` computed. |
| Store | `createStore` / `createMutable` | `createTree` | Plastic uses a deep reactive Proxy object model, not Solid store APIs. |
| Cleanup | `onCleanup` | `onCleanup` (alias export) | Similar behavior; tied to owner/effect scope. |
| Mount | `onMount` | `onMount` | Supported. |
| Context | `createContext/useContext` | `createContext/useContext` | Supported; Provider behavior depends on Babel plugin lazy children transform. |
| Dynamic | `<Dynamic>` | `<Dynamic>` | Basic dynamic component rendering supported. |
| Portal | `<Portal>` | `<Portal>` | Supported. |
| Fragment | `<>...</>` | `Fragment` + JSX fragment | Supported. |
| Conditional Rendering | `<Show>` | `<Either><True/><False/></Either>` | Different component names and compile contract. |
| Multi-branch Matching | `<Switch><Match>` | `<Match><Case/><Default/></Match>` | Similar concept, different API shape. |
| List Rendering | `<For>` / `<Index>` | `<Loop>` | Plastic reuses rows by identity and updates an index signal. |
| Routing | `@solidjs/router` | Built-in `Router/Route/Link/NavLink/Outlet/...` | Plastic routing is built-in and differs from Solid router ecosystem contracts. |
| SSR/Hydrate | `renderToString`/`hydrate` and related APIs | Not implemented | Plastic is currently CSR-only. |
| Suspense/Resource | `Suspense`/`createResource` | Not implemented | Plastic has route `lazy()`, but not a Suspense-style system. |
| Error Boundary | `<ErrorBoundary>` | Not implemented | Component library should avoid assuming this capability exists. |

## 4. Implemented Capabilities (Usable as Component Library Foundation)

### 4.1 Rendering and Reactivity

- JSX directly creates real DOM nodes (no diff/reconcile)
- Text children support signal/computed/getter-driven updates
- Common DOM properties support reactive updates
- Reactive `className` updates remove stale class tokens
- `style` supports both string and object forms; object form clears removed keys
- `createTree` supports deep reactive object and array use cases

### 4.2 Lifecycle and Scope

- Owner tree management
- `onMount` and `onCleanup`
- Child-first disposal order; owner effects stop before cleanup callbacks flush
- `renderApp(container, node)` returns an idempotent disposer

### 4.3 Control Flow

- `<Either condition>` + `<True>` + `<False>`
- `<Match value>` + `<Case when>` + `<Default>`
- `<Loop each>{(item, indexSignal) => ...}</Loop>`
- Control-flow branches are lazily evaluated through Babel transforms; inactive branches are not eagerly computed

### 4.4 Routing (CSR)

- `Router/Route/Outlet/Link/NavLink`
- `navigate/useNavigate/useLocation/useRoute/useParams/useSearchParams/useMatch/useNavigationState`
- Supports nested routes, index routes, `*`, dynamic params, query/hash
- Supports route guards and beforeEnter redirects
- Supports relative link target resolution
- Provides `lazy(importFn, { fallback })` for code splitting

## 5. Critical Semantic Differences from Solid.js (Common Pitfalls)

### 5.1 Signal Shape Is Fundamentally Different

Solid:

```js
const [count, setCount] = createSignal(0)
setCount(count() + 1)
```

Plastic:

```js
const count = createSignal(0)
count(count() + 1)
```

Impact:

- Solid component code that assumes tuple signals cannot be copied directly
- Component libraries should use an adapter layer for signal read/write to avoid hard-coding tuple assumptions

### 5.2 Event Binding Is One-Time, Not Reactively Rebound

Plastic event props (for example `onClick`) are intentionally not wrapped by the reactive Babel plugin. Example:

```jsx
<button onClick={flag() ? fnA : fnB} />
```

After initial mount, the listener is not automatically switched when `flag` changes.

Recommendation:

- Keep handler references stable
- Read latest state inside the handler and branch there, instead of relying on rebinding

### 5.3 `classList` Prop Is Not Supported

- Plastic explicitly rejects `classList` (throws an error)
- Component libraries should standardize on `className` string strategies

### 5.4 Control-Flow Component Names Are Not Solid-Native

- Solid commonly uses `<Show>/<Switch>/<Match>/<For>`
- Plastic currently uses `<Either>/<True>/<False>/<Match>/<Case>/<Default>/<Loop>`
- These patterns depend on custom Babel control-flow transforms

If you maintain cross-framework component docs, list this naming and compile contract explicitly.

### 5.5 Routing Is Not Solid Router API-Compatible

Conceptually similar, but Plastic routing is an in-house implementation and not behavior-identical to `@solidjs/router`:

- Hook return shapes, navigation-state reads, and guard behavior should follow Plastic semantics
- Do not assume Solid Router advanced behaviors when porting components

## 6. Common Solid Capabilities Not Yet Implemented (Avoid for Now)

If any of the following is treated as a hard requirement in component library architecture, rework risk is high:

- SSR / Hydration
- Suspense / `createResource`
- Error Boundary
- Scheduling and concurrency helpers (for example `batch`, `untrack`, `startTransition`)
- Common Solid utility APIs (for example `splitProps`, `mergeProps`, `children`, `createSelector`, `createUniqueId`)

Recommendation: in phase one, only depend on the validated minimal API set and avoid early abstraction around missing features.

## 7. Practical Guidance for Component Library Development

### 7.1 Introduce a Compatibility Adapter Layer First

Define a runtime adapter contract inside the component library (for example `signalGet/signalSet`, `cx`, `navigateTo`) to encapsulate Plastic-vs-Solid differences and avoid repeating low-level compatibility code per component.

### 7.2 Strictly Limit the Capability Boundary of the First Component Batch

Initial components should only rely on:

- `createSignal/createTree/createEffect`
- `onMount/onCleanup`
- `className` + `style`
- `Either/Match/Loop`
- Core routing hooks

Do not rely on Suspense/SSR/ErrorBoundary-dependent design in this phase.

### 7.3 Establish Component Library Coding Rules

- Disallow `classList` prop usage
- Disallow dynamic event expressions that depend on rebinding semantics
- Disallow tuple-signal assumptions
- Use documented Plastic control-flow components consistently; do not mix Solid naming in implementation code

## 8. Suggested Evolution Path (Priority Order)

1. Add an official compatibility layer to reduce Solid-to-Plastic migration cost (especially signal shape and control-flow aliases).
2. Fill in baseline utility APIs (for example props helpers) to improve component-library ergonomics.
3. Evaluate and design minimal versions of Suspense/Resource and error boundaries.
4. If SSR is planned, isolate browser-only logic in component code as early as possible.

---

To evolve this file into an executable migration guide, you can add two sections next:

- Reusable Plastic API code templates (forms, overlays, async loading, route guards)
- A line-by-line Solid-to-Plastic migration checklist (mechanical rewrite rules + test checklist)
