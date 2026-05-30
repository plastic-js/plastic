# Layout Route Rebuild Issue

## Problem

In the showcase app, clicking any item in the left-hand menu caused two visible
symptoms in the Chrome DevTools Elements panel:

1. The `<div>` that wraps `<aside>` and `<main>` (the AppShell root) collapsed
   from its previously-expanded state back to a folded state.
2. Both that `<div>` and its parent `<div class="app">` briefly flashed.

In DevTools, a node losing its expanded state is a strong indicator that the
node itself was unmounted and replaced — not merely re-styled. The flashing on
both levels confirms the subtree was detached and a freshly-built subtree was
attached in its place.

## Root Cause

The showcase used a "layout route" pattern:

```jsx
<Router root='/showcase'>
    <Route component={AppShell}>
        <Route component={PageA} path='/a' />
        <Route component={PageB} path='/b' />
        ...
    </Route>
</Router>
```

`AppShell` rendered the sidebar plus `<main><Outlet /></main>`, with `<Outlet />`
swapping in the matched leaf page.

Inside the framework's `Route` implementation, the parent route's render path
runs inside a reactive owner that is subscribed (transitively, via
`readCandidateMatch` / `currentLocation`) to navigation changes. As a result,
every navigation re-invoked `h(AppShell, routeProps)` with a freshly-built
`routeProps` object (new `params`, `query`, `route` references), which caused
the entire AppShell subtree — its root `<div>`, the `<aside>` containing the
sidebar, and the `<main>` — to be materialized as brand-new DOM nodes and
swapped in. The grandparent `<div class="app">` also flashed because its child
was being detached and re-attached.

The semantic expectation of a "layout route" is the opposite: the layout host
should be stable across navigations and only the `<Outlet />` content should
change. The current router does not honor that expectation.

## Temporary Workaround (business-code only)

Stop using the layout-route pattern. Hoist the layout chrome out of the router
tree entirely and place the `<Router>` inside the layout's content slot. Only
leaf routes remain under `<Router>`:

```jsx
renderApp(
    document.body.querySelector('.app'),
    <div style={gridStyle}>
        <Sidebar />
        <main>
            <Router root='/showcase'>
                <Route component={PageA} path='/a' />
                <Route component={PageB} path='/b' />
                ...
            </Router>
        </main>
    </div>,
)
```

Why this avoids the bug:

- The grid `<div>`, `<Sidebar />`, and `<main>` are owned by the top-level
  `renderApp` owner. They never subscribe to `currentLocation`, so navigation
  cannot trigger their reconstruction.
- `<NavLink>` still subscribes to `currentLocation` on its own, fine-grained
  level (only to update its active class), so the active-link highlight keeps
  working.
- Only the subtree inside `<main><Router>...</Router></main>` participates in
  route-driven rebuilds, which is the intended scope.

### Caveats

- This works only for a **single, top-level** layout. Genuinely nested layouts
  (e.g. `PageOne` rendering its own sub-navigation plus an `<Outlet />` for
  `/page-one/sub-a` vs `/page-one/sub-b`) cannot be expressed without using
  the framework's parent-route + `<Outlet />` mechanism, and will continue to
  exhibit the same rebuild behavior on the inner layout.
- If the sidebar ever needs to read route params/query, it can subscribe to
  `currentLocation` itself rather than receiving them as props — keeping its
  reactivity local and avoiding host-node reconstruction.

## Ultimate Fix (framework change)

The layout-route pattern should not rebuild the parent component's host DOM on
every navigation. The router needs to:

1. Materialize `h(component, ...)` for a parent route **once**, when that route
   first becomes active, and reuse the resulting DOM across subsequent
   navigations that still match the same parent.
2. Localize the `currentLocation` subscription to `<Outlet />` (or to the
   nested `Match` it creates) instead of letting it flow through the parent
   component's render owner. The parent component's render owner should not be
   a subscriber to the location signal at all.
3. Only fully re-render the parent component when the parent route itself
   stops matching (i.e. the user navigates to a route under a different parent
   branch).

Concretely, in `src/router.js`, the `renderMatch` branch for parent routes
should memoize the `h(component, routeProps)` call against the parent's match
identity, and the reactive read of `currentLocation` should occur inside the
`buildRouteMatch` that `<Outlet />` mounts — not in the closure that wraps
`h(component, ...)`.

After this fix, the temporary workaround above can be reverted and arbitrary
levels of layout nesting will behave correctly: stable layout hosts, swapping
only the leaf content.
