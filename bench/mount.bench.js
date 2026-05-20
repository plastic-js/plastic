// @vitest-environment jsdom

import { bench, describe } from 'vitest'
import { h, renderApp } from '../src/index.js'

const Row = ({ i })=> h('div', { className: 'row' }, h('span', null, 'item ', i))

const App = ({ n })=> {
	const children = []
	for (let i = 0; i < n; i += 1){
		children.push(h(Row, { i, key: i }))
	}
	return h('div', null, children)
}

describe('mount', () => {
	for (const n of [100, 1000, 5000]){
		bench(`mount ${n} components`, () => {
			const root = document.createElement('div')
			const dispose = renderApp(root, h(App, { n }))
			dispose()
		})
	}
})
