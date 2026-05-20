// @vitest-environment jsdom

// See micro-h-plain.bench.js note: Plastic builds real DOM in h(); React/Vue
// build VDOM. Numbers here include jsdom DOM-creation cost for Plastic only.

import { bench, describe } from 'vitest'
import { h as plasticH } from '../src/index.js'
import { createElement as reactH } from 'react'
import { h as vueH } from 'vue'

describe('h() throughput — nested tree (depth 3, 1000 trees)', () => {
	bench('plastic nested x1000', () => {
		for (let i = 0; i < 1000; i += 1){
			plasticH('div', null,
				plasticH('span', { className: 'a' }, 'x'),
				plasticH('span', { className: 'b' }, 'y'),
				plasticH('span', { className: 'c' }, plasticH('em', null, 'z')),
			)
		}
	})
	bench('react nested x1000', () => {
		for (let i = 0; i < 1000; i += 1){
			reactH('div', null,
				reactH('span', { className: 'a' }, 'x'),
				reactH('span', { className: 'b' }, 'y'),
				reactH('span', { className: 'c' }, reactH('em', null, 'z')),
			)
		}
	})
	bench('vue nested x1000', () => {
		for (let i = 0; i < 1000; i += 1){
			vueH('div', null, [
				vueH('span', { class: 'a' }, 'x'),
				vueH('span', { class: 'b' }, 'y'),
				vueH('span', { class: 'c' }, vueH('em', null, 'z')),
			])
		}
	})
})
