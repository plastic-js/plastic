// @vitest-environment jsdom

// Isolate Loop's per-row overhead by comparing two ways of rendering the same
// N rows in Plastic:
//   - "static map": items.map(...) inside an element — no <Loop>, no reactivity
//   - "Loop":       <Loop each={signal}>{...}</Loop>
// Difference is roughly the Loop component's per-row cost.

import { bench, describe } from 'vitest'
import { Loop, createSignal, h, renderApp } from '../src/index.js'

const makeItems = (n)=> {
	const items = new Array(n)
	for (let i = 0; i < n; i += 1){
		items[i] = { id: i, label: `item ${i}` }
	}
	return items
}

const renderStatic = (host, items)=> {
	const children = items.map(item=> h('li', { key: item.id }, h('span', null, item.label)))
	return renderApp(host, h('ul', null, children))
}

const renderLoop = (host, itemsSignal)=> renderApp(
	host,
	h('ul', null, h(Loop, { each: itemsSignal }, (item)=> h('li', null, h('span', null, item.label)))),
)

describe('Plastic list render — Loop vs static .map()', () => {
	for (const n of [100, 1000, 5000]){
		const items = makeItems(n)

		bench(`static .map() ${n} rows`, () => {
			const host = document.createElement('div')
			const dispose = renderStatic(host, items)
			dispose()
		})

		bench(`Loop ${n} rows`, () => {
			const host = document.createElement('div')
			const itemsSignal = createSignal(items)
			const dispose = renderLoop(host, itemsSignal)
			dispose()
		})
	}
})
