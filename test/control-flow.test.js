// @vitest-environment jsdom

// Regression coverage for the control-flow components (Loop, Either, Match,
// Portal). Each component creates a child owner inside a binding effect, which
// previously interacted poorly with alien-signals' auto parent-child link:
// child binding effects (like text-node bindings for `{signal}`) got attached
// as deps of the outer binding effect, then unwatched by purgeDeps on re-run.
// The fix wraps the materialization step in runUntracked so child effects
// belong only to their own owner.
//
// Loop's case actually manifested as a bug (rows are reused across re-runs).
// Either/Match/Portal masked it via explicit disposeOwner / outer
// materializeComponentDescriptor wrap, but we still cover them as guards.

import { afterEach, describe, expect, it } from 'vitest'
import {
	Case,
	Default,
	Either,
	False,
	Loop,
	Match,
	Portal,
	True,
	createSignal,
	h,
	renderApp,
} from '../src/index.js'

afterEach(()=> {
	document.body.innerHTML = ''
})

describe('Loop', ()=> {
	const seed = ()=> [
		{ id: 'a', label: 'Alpha' },
		{ id: 'b', label: 'Beta' },
		{ id: 'c', label: 'Gamma' },
	]

	const Showcase = ()=> {
		const items = createSignal(seed())
		const rotate = ()=> {
			const list = items()
			items([list[list.length - 1], ...list.slice(0, -1)])
		}
		return (
			<div>
				<button type='button' onClick={rotate}>Rotate</button>
				<ul>
					<Loop each={items}>
						{(item, index)=> (
							<li>
								<span>{index}</span>
								<span>{item.label}</span>
							</li>
						)}
					</Loop>
				</ul>
			</div>
		)
	}

	const setup = ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		renderApp(container, h(Showcase))
		const rotateBtn = container.querySelector('button')
		const ul = container.querySelector('ul')
		const indexes = ()=> [...ul.querySelectorAll('li')].map(li=> Number(li.querySelectorAll('span')[0].textContent))
		const labels = ()=> [...ul.querySelectorAll('li')].map(li=> li.querySelectorAll('span')[1].textContent)
		return { rotateBtn, indexes, labels }
	}

	it('row index signals update on every rotate, not just the first', ()=> {
		const env = setup()
		expect(env.indexes()).toEqual([0, 1, 2])
		expect(env.labels()).toEqual(['Alpha', 'Beta', 'Gamma'])
		env.rotateBtn.click()
		expect(env.indexes()).toEqual([0, 1, 2])
		expect(env.labels()).toEqual(['Gamma', 'Alpha', 'Beta'])
		env.rotateBtn.click()
		expect(env.indexes()).toEqual([0, 1, 2])
		expect(env.labels()).toEqual(['Beta', 'Gamma', 'Alpha'])
		env.rotateBtn.click()
		expect(env.indexes()).toEqual([0, 1, 2])
		expect(env.labels()).toEqual(['Alpha', 'Beta', 'Gamma'])
	})
})

describe('Either', ()=> {
	it('signal updates inside a branch are reactive on initial render', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const cond = createSignal(true)
		const count = createSignal(0)

		const App = ()=> (
			<Either condition={cond}>
				<True>
					<span data-test='count'>{count}</span>
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		const span = container.querySelector('[data-test="count"]')
		expect(span.textContent).toBe('0')
		count(1)
		expect(span.textContent).toBe('1')
	})

	it('signal updates inside a re-rendered branch stay reactive after a flip', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const cond = createSignal(true)
		const count = createSignal(0)

		const App = ()=> (
			<Either condition={cond}>
				<True>
					<span data-test='count'>{count}</span>
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		cond(false)
		expect(container.querySelector('[data-test="off"]')).not.toBeNull()
		cond(true)
		const span = container.querySelector('[data-test="count"]')
		expect(span.textContent).toBe('0')
		count(5)
		expect(span.textContent).toBe('5')
		count(7)
		expect(span.textContent).toBe('7')
	})
})

describe('Match', ()=> {
	it('cases keep reactivity after value flips through them', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const which = createSignal('a')
		const a = createSignal(0)
		const b = createSignal(100)

		const App = ()=> (
			<Match value={which}>
				<Case when='a'>
					<span data-test='a'>{a}</span>
				</Case>
				<Case when='b'>
					<span data-test='b'>{b}</span>
				</Case>
				<Default>
					<span data-test='other'>other</span>
				</Default>
			</Match>
		)
		renderApp(container, h(App))
		expect(container.querySelector('[data-test="a"]').textContent).toBe('0')
		a(1)
		expect(container.querySelector('[data-test="a"]').textContent).toBe('1')
		which('b')
		expect(container.querySelector('[data-test="b"]').textContent).toBe('100')
		b(200)
		expect(container.querySelector('[data-test="b"]').textContent).toBe('200')
		which('a')
		expect(container.querySelector('[data-test="a"]').textContent).toBe('1')
		a(2)
		expect(container.querySelector('[data-test="a"]').textContent).toBe('2')
	})
})

describe('Portal', ()=> {
	it('signals in Portal content stay reactive', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const count = createSignal(0)
		const App = ()=> (
			<div>
				<Portal>
					<span data-test='ported'>{count}</span>
				</Portal>
			</div>
		)
		renderApp(container, h(App))
		const span = document.body.querySelector('[data-test="ported"]')
		expect(span).not.toBeNull()
		expect(span.textContent).toBe('0')
		count(1)
		expect(span.textContent).toBe('1')
	})

	it('Portal nested inside an Either branch stays reactive across flips', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const cond = createSignal(true)
		const count = createSignal(0)
		const App = ()=> (
			<Either condition={cond}>
				<True>
					<Portal>
						<span data-test='via-portal'>{count}</span>
					</Portal>
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		const span1 = document.body.querySelector('[data-test="via-portal"]')
		expect(span1.textContent).toBe('0')
		count(1)
		expect(span1.textContent).toBe('1')
		cond(false)
		expect(document.body.querySelector('[data-test="via-portal"]')).toBeNull()
		cond(true)
		const span2 = document.body.querySelector('[data-test="via-portal"]')
		expect(span2).not.toBeNull()
		expect(span2.textContent).toBe('1')
		count(2)
		expect(span2.textContent).toBe('2')
	})
})
