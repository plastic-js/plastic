// @vitest-environment jsdom

import { bench, describe } from 'vitest'
import { Loop, createSignal, h, renderApp } from '../src/index.js'

const N = 1000

const makeItems = (n)=> {
	const items = new Array(n)
	for (let i = 0; i < n; i += 1){
		items[i] = { id: i, label: `item ${i}` }
	}
	return items
}

const Row = (item)=> h('li', null, item.label)

const setup = ()=> {
	const root = document.createElement('div')
	const items = createSignal(makeItems(N))
	const dispose = renderApp(root, h('ul', null, h(Loop, { each: items }, Row)))
	return { items, dispose }
}

describe('diff', () => {
	bench('reverse 1000 keyed rows', () => {
		const { items, dispose } = setup()
		items([...items()].reverse())
		dispose()
	})

	bench('shuffle 1000 keyed rows', () => {
		const { items, dispose } = setup()
		const next = [...items()]
		for (let i = next.length - 1; i > 0; i -= 1){
			const j = (i * 1103515245 + 12345) % (i + 1)
			;[next[i], next[j]] = [next[j], next[i]]
		}
		items(next)
		dispose()
	})

	bench('insert 100 in middle', () => {
		const { items, dispose } = setup()
		const list = items()
		const mid = list.length >> 1
		const extra = []
		for (let i = 0; i < 100; i += 1){
			extra.push({ id: N + i, label: `new ${i}` })
		}
		items([...list.slice(0, mid), ...extra, ...list.slice(mid)])
		dispose()
	})

	bench('remove every other row', () => {
		const { items, dispose } = setup()
		items(items().filter((_, i)=> i % 2 === 0))
		dispose()
	})

	bench('swap first and last', () => {
		const { items, dispose } = setup()
		const next = [...items()]
		;[next[0], next[next.length - 1]] = [next[next.length - 1], next[0]]
		items(next)
		dispose()
	})
})
