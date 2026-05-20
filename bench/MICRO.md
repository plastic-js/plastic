# Micro-bench: where Plastic's mount/list cost actually lives

Follow-up to `bench-e2e/RESULTS.md`. Goal: figure out whether the 2× gap on
`mount-5000` / `largeList-10000` comes from `h()` overhead or `Loop` overhead.

Run with: `npm run bench -- bench/micro-*.bench.js`

## Finding 1 — Plastic's `h()` is fundamentally different

Plastic's `h('div', …)` **eagerly calls `document.createElement`** and returns a
real DOM node. React/Vue's `h()` returns a lightweight VDOM descriptor; DOM
creation is deferred to commit. So measuring "h() throughput" for a string tag
is apples-to-oranges:

| 10k `h('div', props, 'text')` calls | hz | ms/op |
|---|---|---|
| plastic h() (jsdom DOM creation included) | 5.6   | 178 |
| react createElement (VDOM only)           | 66.6  | 15  |
| vue h() (VDOM only)                       | 1,448 | 0.7 |

This is **expected**, not a bug. The number that matters for Plastic isn't
"how fast is your h()" — it's "how fast is your render path end-to-end,"
which we already measured in the e2e bench.

## Finding 2 — Plastic's h() for components is genuinely fast

For `h(Component, props)` (no string tag → no eager DOM), Plastic returns a
descriptor and is fair to compare:

| 10k `h(Component, props)` calls | hz | ns/op |
|---|---|---|
| plastic h(Component)            | 4,585 | 22   |
| vue h(Component)                | 1,550 | 645  |
| react createElement(Component)  | 68    | 14,700 |

Plastic 3× faster than Vue, ~70× faster than React.
(React's number is dev-build dominated — production is ~3-5× faster.)

**So component creation is not Plastic's bottleneck.**

## Finding 3 — Loop's per-row overhead is the bottleneck

Same N rows, two render strategies in Plastic:
- **static** `.map(...)` — array of children, no reactivity, no `<Loop>`
- **Loop** — `<Loop each={signal}>{row}</Loop>`

| N    | static (ms) | Loop (ms) | Loop overhead |
|------|-------------|-----------|---------------|
| 100  | 3.5         | 4.5       | +28%          |
| 1000 | 35          | 74        | **+108%**     |
| 5000 | 209         | 864       | **+313%**     |

Loop overhead **scales worse than linearly**. At 5000 rows it adds 655 ms of
work on top of the baseline DOM creation. This matches the gap seen in
`bench-e2e` against Solid's `<For>`:

- Plastic `largeList-10000` (e2e, Chromium): 534 ms
- Solid   `largeList-10000` (e2e, Chromium): 263 ms

That ~270 ms delta is consistent with Loop's per-row setup cost (subscriptions,
per-row reactive scope, key tracking).

## Where to look in the code

`Loop` is in `src/jsx-runtime.js` (re-exported). Likely candidates for the
super-linear scaling:

1. **Per-row reactive scope / effect creation**. Solid's `<For>` creates one
   effect per row but with a very tight setup path. If Plastic creates extra
   computeds, signals, or cleanup registrations per row, that compounds.
2. **Key/diff bookkeeping**. If Loop maintains structures that aren't O(1) per
   row (e.g., array searches, map rebuilds), 5× the rows = 25× the work — and
   that's what the data shows (4× the per-row cost at 5× the rows).
3. **DOM insertion strategy**. Inserting children one-by-one vs. batching via
   DocumentFragment can also explain non-linear scaling under jsdom.

A profiler run on `Loop 5000 rows` (Chrome DevTools or `--prof`) will point
to the hot path in a few minutes.

## Conclusion

| Hypothesis from e2e analysis | Verdict |
|---|---|
| h() / renderApp per-component overhead | **Refuted** — component h() is faster than Vue/React |
| Loop per-row overhead                  | **Confirmed** — 4× cost at 5k rows, super-linear |

Optimizing `Loop` (not `h()`) is the highest-leverage change to close the gap
with Vue/Solid on list-heavy benchmarks.
