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
- [ ] Implement Component Function Execution Context (owner/scope tree for reactive cleanup).
- [ ] Generalize effect-based subscriptions from text nodes to all reactive DOM bindings.
- [ ] Track cleanup handles for every binding effect.
- [ ] Define unmount trigger mechanism: how components/nodes signal their removal (via control flow, explicit call, or observer).
- [ ] Dispose all binding effects and event listeners when a component unmounts.
- [ ] Propagate disposal down the owner tree so child scopes are cleaned up automatically.
- [ ] Support onCleanup inside effects (run before each re-execution, not only on unmount).
- [ ] Implement onMount and onCleanup hooks as the public-facing lifecycle API.
- [ ] Support ref prop for accessing DOM elements after mount.

## Control Flow
- [ ] Implement conditional rendering.
- [ ] Implement <Show> component.
- [ ] Ternary expressions.
- [ ] Use comment nodes as anchors for dynamic content insertion.
- [ ] Implement list rendering.
- [ ] Support rendering lists using tag names (e.g., <For> or <Map>).
- [ ] Implement a reconciliation algorithm for list rendering (e.g., using keys to optimize node reuse).
- [ ] Guarantee deterministic update order between parent effects and child effects.

## Performance Optimization
- [ ] Avoid unnecessary DOM writes when a reactive prop resolves to the same value.
- [ ] Batch multiple signal-triggered DOM updates in the same microtask.
- [ ] Implement batching updates to ensure that multiple signal modifications within the same microtask only trigger.
- [ ] Ensure that updates are applied in the correct order and that any necessary debouncing or batching strategies are implemented to optimize performance.
