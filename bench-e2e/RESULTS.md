# Bench Results — Plastic vs React / Vue / Solid

Real Chromium via Playwright. Each framework uses its idiomatic compiled JSX/template path:
- **Plastic** — local source + babel-plugin-transform-jsx-reactive
- **React 19** — @vitejs/plugin-react, `createRoot` + `flushSync`
- **Vue 3.5** — @vitejs/plugin-vue, SFC templates
- **Solid 1.9** — vite-plugin-solid (compiled JSX, the optimized path)

Each scenario: 2 warmup runs + 5 measured runs, median reported. Lower is better.

## Summary (median ms)

| Scenario            | plastic | react | vue   | solid |
|---------------------|---------|-------|-------|-------|
| mount-100           | 31.8    | 28.5  | 29.8  | 30.8  |
| mount-1000          | 28.9    | 28.7  | 28.4  | 28.6  |
| mount-5000          | **147.3** | 129.7 | 62.2  | 67.8  |
| update-1000         | 33.2    | 50.0  | 32.6  | 33.0  |
| largeList-1000      | 55.3    | 43.3  | 29.2  | 27.6  |
| largeList-10000     | **533.8** | 499.3 | 326.4 | 263.4 |
| diff-reverse-1000   | 43.1    | 61.5  | 44.7  | 58.3  |
| diff-shuffle-1000   | 35.0    | 64.2  | 40.7  | 33.4  |
| diff-insert-1000    | 48.0    | 33.8  | 31.5  | 31.7  |
| diff-remove-1000    | 31.5    | 38.6  | 30.3  | 30.8  |
| diff-swap-1000      | 34.5    | 67.1  | 27.0  | 29.6  |

## ~33 ms floor

The timing harness does `getBoundingClientRect()` + 2× `requestAnimationFrame` to force layout+paint flush. At 60 Hz that's ~33 ms minimum, which is why every fast operation pins at ~28-33. Cross-framework comparison is still valid (same floor for everyone) but **small-cost ops can't be distinguished** — anything under ~33 ms is "fast enough."

The meaningful numbers are the ones well above floor.

## Where Plastic stands

**Comparable to the field**
- `mount-100/1000`: all four sit on the floor.
- `update-1000`: 33 ms — on par with Vue/Solid, faster than React. Signals-driven fine-grained updates aren't going through any VDOM, so this is expected.
- diff ops on 1k rows: roughly in the Vue/Solid range, ahead of React on shuffle/swap.

**~2× slower than Vue/Solid**
- `mount-5000`: 147 vs Vue 62 / Solid 68 — Plastic spends roughly twice the time creating 5k components.
- `largeList-10000`: 534 vs Vue 326 / Solid 263 — same picture for `<Loop>` initial render at scale.

**Roughly tied with React**
- `mount-5000` and `largeList-10000` are within 5-10% of React.

## Interpretation

Plastic's reactive update path is competitive — once mounted, fine-grained updates have no measurable overhead vs Solid. The gap is on the **construction side**: building lots of components or list rows. Two likely causes worth profiling:

1. **Per-component overhead in `renderApp` / `jsx` / `h`**. Vue's template compiler and Solid's JSX compiler both emit very tight code (`document.createElement` + direct property assignment). Plastic's `h()` plus the reactive binding layer probably does more per node.
2. **`Loop` component**. The 2× gap on `largeList` is almost certainly Loop's per-row work — Solid's `<For>` is famously hand-tuned.

## Caveats

- jsdom not used — real Chromium headless, but headless ≠ headed (minor differences in compositing).
- Single machine, no warmup of the JIT beyond 2 runs. High-variance runs visible in raw samples (`results.json`).
- Bundle size, hydration, SSR, memory not measured.
- The `update-1000` scenario hammers a single signal 1000× back-to-back — this rewards batching but doesn't reflect realistic UI patterns.
- `Loop`/`<For>`/`v-for` are not 100% semantically identical (e.g., index-as-signal differs); the comparison is "what idiomatic code looks like," not algorithmically matched.

## How to run

```bash
npm run bench:e2e
```

Outputs the table above and writes `bench-e2e/results.json`.
