// @vitest-environment jsdom

import { bench, describe } from 'vitest'
import { Loop, createSignal, h, renderApp } from '../src/index.js'

const makeItems = (n)=> {
	const items = new Array(n)
	for (let i = 0; i < n; i += 1){
		items[i] = { id: i, label: `item ${i}` }
	}
	return items
}

const Row = (item, index)=> h('li', null, h('span', null, '#', index), ' ', item.label)

describe('large list', () => {
	for (const n of [1000, 10_000]){
		bench(`render Loop with ${n} items`, () => {
			const root = document.createElement('div')
			const items = createSignal(makeItems(n))
			const dispose = renderApp(root, h('ul', null, h(Loop, { each: items }, Row)))
			dispose()
		})
	}
})
