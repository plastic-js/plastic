// @vitest-environment jsdom

// NOTE: Plastic's h() for a string tag eagerly calls document.createElement —
// it returns a real DOM node, not a VDOM. React/Vue's h() returns a
// lightweight descriptor and defer DOM creation to commit time. So this
// comparison is apples-to-oranges for plain elements: Plastic is doing
// strictly more work per call. The "component" variant (separate file) is
// fairer because all three return a lightweight descriptor in that case.

import { bench, describe } from 'vitest'
import { h as plasticH } from '../src/index.js'
import { createElement as reactH } from 'react'
import { h as vueH } from 'vue'

const N = 10_000

describe('h() throughput — plain element', () => {
	bench('plastic h() x10k', () => {
		for (let i = 0; i < N; i += 1){
			plasticH('div', { className: 'x', id: 'y' }, 'text')
		}
	})
	bench('react createElement x10k', () => {
		for (let i = 0; i < N; i += 1){
			reactH('div', { className: 'x', id: 'y' }, 'text')
		}
	})
	bench('vue h() x10k', () => {
		for (let i = 0; i < N; i += 1){
			vueH('div', { class: 'x', id: 'y' }, 'text')
		}
	})
})
