import { bench, describe } from 'vitest'
import { h as plasticH } from '../src/index.js'
import { createElement as reactH } from 'react'
import { h as vueH } from 'vue'

const N = 10_000
const Component = ()=> null

describe('h() throughput — component', () => {
	bench('plastic h(Component) x10k', () => {
		for (let i = 0; i < N; i += 1){
			plasticH(Component, { id: i })
		}
	})
	bench('react createElement(Component) x10k', () => {
		for (let i = 0; i < N; i += 1){
			reactH(Component, { id: i })
		}
	})
	bench('vue h(Component) x10k', () => {
		for (let i = 0; i < N; i += 1){
			vueH(Component, { id: i })
		}
	})
})
