## Static Element Creation
- [X] Support standard HTML tags.
- [X] Support nested children.
- [X] Support style object attributes.
- [X] Support event binding via onXxx attributes.
- [ ] Support SVG.
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
- [ ] Support ref prop for accessing DOM elements after mount.

## Babel Plugin for JSX Transformation
- [X] Implement a Babel plugin to transform JSX ternary syntax into JavaScript function calls.

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

### Extras
- [X] `<Portal container={el}>` — render content outside the component tree (modals, tooltips).
- [ ] `<Dynamic component={tag}>` — select component or HTML tag dynamically at runtime.
- [ ] Guarantee deterministic update order between parent effects and child effects.
- [ ] Implement a simple state management system using the tree API.
- [X] Implement Context API for passing data through the component tree without prop drilling.

## Performance Optimization
- [ ] Avoid unnecessary DOM writes when a reactive prop resolves to the same value.
- [ ] Batch multiple signal-triggered DOM updates in the same microtask.
- [ ] Implement batching updates to ensure that multiple signal modifications within the same microtask only trigger.
- [ ] Ensure that updates are applied in the correct order and that any necessary debouncing or batching strategies are implemented to optimize performance.

# Routing
- [ ] Implement a basic client-side router.
- [ ] Support route parameters and query strings.
- [ ] Support nested routes and route guards.
- [ ] Implement a Link component for navigation.
- [ ] Support dynamic route matching and route transitions.
