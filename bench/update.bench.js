// @vitest-environment jsdom

import { bench, describe } from 'vitest'
import { createComputed, createSignal, h, renderApp } from '../src/index.js'

describe('update', () => {
	bench('single signal -> single text node', () => {
		const root = document.createElement('div')
		const count = createSignal(0)
		const dispose = renderApp(root, h('p', null, 'count: ', createComputed(()=> count())))

		for (let i = 0; i < 1000; i += 1){
			count(i)
		}

		dispose()
	})

	bench('signal fan-out to 100 computed bindings', () => {
		const root = document.createElement('div')
		const value = createSignal(0)
		const children = []
		for (let i = 0; i < 100; i += 1){
			children.push(h('span', null, createComputed(()=> value() + i)))
		}
		const dispose = renderApp(root, h('div', null, children))

		for (let i = 0; i < 100; i += 1){
			value(i)
		}

		dispose()
	})
})
