## [ ] Static Element Creation
- [X] Support standard HTML tags.
- [X] Support nested children.
- [X] Support style object attributes.
- [X] Support event binding via onXxx attributes.
- [ ] Support SVG
- [X] Support boolean attributes (e.g., disabled, checked).
- [X] Support class merging for static classes (e.g., class="btn" and classList={{ active: isTrue }} should coexist without overwriting each other).

## [ ] Dynamic Element Manipulation
- [X] Support dynamic updates to text nodes.
- [X] Support reactive values in props via signal, computed.
- [X] Support dynamic updates to className, class and classList object entries .
- [X] Merge static classes and reactive classes without overwriting each other.
- [X] Remove stale class tokens when reactive class values change.
- [ ] Support dynamic updates to boolean attributes such as disabled, checked, selected, and readOnly.
- [ ] Support dynamic updates to style strings and style objects.
- [ ] Diff style objects by key so removed style fields are cleaned up correctly.
- [ ] Normalize reactive sources so text, prop, class, style, and child bindings use the same update pipeline.
- [ ] Guarantee deterministic update order between parent effects and child effects.

## [ ] Component System
- [ ] Support function components as JSX tags.
- [ ] Support props passing to child components.
- [ ] Ensure reactive props maintain reactivity when passed to child components.
- [ ] Handle props.children injection for child components.
- [ ] Support Fragment syntax (<>...</>) or Fragment component for multiple root nodes.

## [ ] Reactivity Integration
- [ ] Implement an effect/watcher system to listen for signal changes and update the DOM accordingly.
- [ ] Implement batching updates to ensure that multiple signal modifications within the same microtask only trigger
- [ ] Ensure that updates are applied in the correct order and that any necessary debouncing or batching strategies are implemented to optimize performance.

## [] Control Flow
- [ ] Implement conditional rendering
    - [ ] Implement <Show> component 
    - [ ] Ternary expressions.
    - [ ] Use comment nodes as anchors for dynamic content insertion.
- [ ] Implement list rendering
    - [ ] Support rendering lists using tag names (e.g., <For> or <Map>).
    - [ ] Implement a reconciliation algorithm for list rendering (e.g., using keys to optimize node reuse).

## [ ] Lifecycle & Resource Management
- [ ] Implement onMount and onCleanup hooks for components.
- [ ] Ensure that when a component unmounts, all associated internal effects are automatically disposed.
- [ ] Implement Component Function Execution Context.
- [ ] Implement a strategy for cleaning up resources when components are unmounted, including event listeners and dynamic nodes.
- [ ] Dispose binding effects when nodes are removed or components unmount.
- [ ] Track cleanup handles for every binding effect.
- [ ] Generalize effect-based subscriptions from text nodes to all reactive DOM bindings.

## [ ] Performance Optimization
- [ ] Avoid unnecessary DOM writes when a reactive prop resolves to the same value.
- [ ] Batch multiple signal-triggered DOM updates in the same microtask.
