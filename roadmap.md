## Static Element Creation
- [X] Support standard HTML tags.
- [X] Support nested children.
- [X] Support style object attributes.
- [X] Support event binding via onXxx attributes.
- [X] Support SVG.
- [X] Support boolean attributes (e.g., disabled, checked).
- [X] Map JSX camelCase prop names to lowercase DOM properties (autoFocus → autofocus, autoComplete → autocomplete, autoPlay → autoplay, encType → enctype, hrefLang → hreflang).
- [X] Support className for static classes.

## Dynamic Element Manipulation
- [X] Support dynamic updates to text nodes.
- [X] Support reactive values in props via signal, computed.
- [X] Support dynamic updates to className.
- [X] Remove stale class tokens when className values change reactively.
- [X] Support dynamic updates to boolean attributes such as disabled, checked, selected, and readOnly.
- [X] Support dynamic updates to style strings and style objects.
- [X] Diff style objects by key so removed style fields are cleaned up correctly.
- [X] Normalize reactive sources so text, prop, class, style, and child bindings use the same update pipeline.

## Component System
- [X] Support function components as JSX tags.
- [X] Support props passing to child components.
- [X] Ensure reactive props maintain reactivity when passed to child components.
- [X] Support Fragment syntax (<>...</>) or Fragment component for multiple root nodes.

## Lifecycle & Resource Management

### Owner/Scope Tree System (Core Foundation)
- [X] Implement owner/scope tree for component function execution context.
- [X] Support parent-child owner relationships to track component hierarchy.
- [X] Propagate disposal down the owner tree so child scopes are cleaned up automatically.

### Effect & Binding System (Reactive Tracking)
- [X] Create binding effects that integrate with owner system for automatic cleanup.
- [X] Support effect-level cleanups within bindings (run before each re-execution).
- [X] Generalize effect-based subscriptions across all reactive DOM bindings (text, props, classes, styles, attributes).

### Cleanup & Resource Management (Disposal Mechanism)
- [X] Track cleanup handles for every binding effect and event listener.
- [X] Support registerCleanup API for manual resource cleanup within effect and component scopes.
- [X] Execute all cleanups in reverse order during owner disposal.
- [X] Dispose all binding effects and event listeners when a component unmounts.

### Lifecycle Hooks (Public API)
- [X] Implement onMount hook - register callbacks to run after component mount.
- [X] Implement onUnmount hook - register callbacks to run on component unmount.
- [X] Support onCleanup inside effects (run before each re-execution, not only on unmount).
- [X] Execute lifecycle hooks with correct owner context and deterministic order.

### Component & Event Lifecycle (Integration)
- [X] Auto-cleanup event listeners via registerCleanup on addEventListener.
- [X] Execute root component onMount callbacks after renderApp completion.
- [X] Return disposer function from renderApp for manual cleanup and re-rendering.

### Future Enhancements
- [X] Support ref prop for accessing DOM elements after mount.

## Babel Plugin for JSX Transformation
- [X] Implement a Babel plugin to transform JSX ternary syntax into JavaScript function calls.
- [ ] Runtime duplicate-attribute detection: the compile-time check in `transform-jsx-reactive` cannot see inside spread sources (their contents are dynamic). Add a `mergeProps`-level check that throws when a spread contributes a key already supplied by a named attribute on the same element. Honor the same whitelist as the compile-time check (`class`, `className`, `style`).

## Control Flow

### Foundation
- [X] Implement `mountDynamic(anchor, getContent)` primitive — reactive branch switching via comment-node anchors, owner disposal, and onMount coordination.

### `<Either>` Conditional Rendering
- [X] Implement `<Either condition={...}>` with `<True>` and `<False>` slot components.
- [X] Extend Babel plugin to lazily transform `<True>`/`<False>` children into `trueBranch`/`falseBranch` factory props, preventing eager evaluation of the inactive branch.
- [X] Dispose previous branch owner and remove its DOM nodes when condition changes.
- [X] Call `runOwnerMounts` for newly activated branches when anchor is already in the live DOM.

### `<Loop>` List Rendering
- [X] Implement `<Loop each={items}>{(item, index) => <Row />}</Loop>` with a render-function child.
- [X] Dispose item owners and remove their nodes when items are removed from the list.

### `<Match>` Multi-branch Rendering
- [X] Implement `<Match>` with `<Case when={...}>` and `<Default>` slot components.
- [X] Support value-match style: `<Match value={x}><Case when="a">…</Case></Match>`.
- [X] Extend Babel plugin to lazily wrap `<Case>`/`<Default>` children as factory props.
- [X] Built on the same `mountDynamic` primitive as `<Either>`.

### Structure Validation (TODO)
- [ ] Control Flow Structure Validation:
  - Parent components (e.g., For, Show, Switch, Match, Either, Loop, etc.) must validate their children at runtime to ensure:
    - Only allowed child tags are present (e.g., For must have Each, Show must have When/Else, Match must have Case/Default, Either must have True/False, etc.).
    - No foreign or unrelated components are present as children.
  - Child components (e.g., When, Else, Each, Case, Default, True, False, etc.) must validate at runtime:
    - They can only appear as direct children of their designated parent components (e.g., Switch, Show, For, Match, Either, Loop, etc.).
  - If the structure is invalid, throw a clear error to help developers locate the problem.

# Routing
- [X] Implement a basic client-side router.
  - [X] Add a standalone `src/router.js` module so routing logic stays out of `jsx-runtime.js`.
  - [X] Implement `<Router>` with History API navigation support, a reactive current-path signal, and browser navigation listeners.
  - [X] Provide routing context with `currentPath`, `navigate`, and `createHref` helpers for child components.
  - [X] Implement `<Route path="...">` with exact static-path matching and lazy rendering for the active branch only.
  - [X] Implement `<Link to="...">` that renders a normal anchor `href` and intercepts internal left-click navigation.
  - [X] Export router APIs from the public entry and cover initial render, route changes, link clicks, and back/forward navigation in tests.
- [X] Support route parameters and query strings.
- [X] Support nested routes and `Outlet`-based child route rendering.
- [X] Support route guards — synchronous `guard` / `beforeEnter` hooks on `<Route>`; returning `false` blocks the route; returning a string or `{ pathname, search, hash }` object redirects with `replace: true`.
- [X] Implement a Link component for navigation.
- [X] Support lazy loading via `lazy(importFn, options?)` — dynamic import with signal-based re-render and optional fallback component.
- [X] Support dynamic route matching and route transitions.

## Performance Optimization
- [X] Avoid unnecessary DOM writes when a reactive prop resolves to the same value.
- [ ] Batch multiple signal-triggered DOM updates in the same microtask.
- [X] Implement batching updates to ensure that multiple signal modifications within the same microtask only trigger.
- [ ] Ensure that updates are applied in the correct order and that any necessary debouncing or batching strategies are implemented to optimize performance.

# Extras
- [X] `<Portal container={el}>` — render content outside the component tree (modals, tooltips).
- [X] `<Dynamic component={tag}>` — select component or HTML tag dynamically at runtime.
- [X] Implement `createAsync(source)` helper that accepts a Promise or Promise factory and exposes `isLoading`, `data`, `error`, and `run`.
- [ ] Guarantee deterministic update order between parent effects and child effects.
- [ ] Implement a simple state management system using the tree API.
- [X] Implement Context API for passing data through the component tree without prop drilling.
