## [ ] Static Element Creation
- [X] Support standard HTML tags.
- [X] Support nested children.
- [X] Support style object attributes.
- [X] Support event binding via onXxx attributes.
- [ ] Support SVG
- [ ] Support boolean attributes (e.g., disabled, checked).
- [ ] Support conditional classes via className attribute (e.g., className={isActive ? 'active' : ''}).
- [ ] Support class merging for static and dynamic classes (e.g., class="btn" and classList={{ active: isTrue }} should coexist without overwriting each other).

## [ ] Dynamic Element Manipulation
- [ ] Support dynamic updates to text nodes.
- [ ] Support dynamic updates to attributes and styles.

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
