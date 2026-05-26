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
	it('renders array children from .map() in True branch', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const items = ['a', 'b', 'c']

		const App = ()=> (
			<Either condition={true}>
				<True>
					{items.map((ch)=> <span data-test='item'>{ch}</span>)}
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		const rendered = [...container.querySelectorAll('[data-test="item"]')].map(el=> el.textContent)
		expect(rendered).toEqual(['a', 'b', 'c'])
	})

	it('renders array children from .map() in False branch', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const items = ['x', 'y']

		const App = ()=> (
			<Either condition={false}>
				<True>
					<span data-test='off'>off</span>
				</True>
				<False>
					{items.map((ch)=> <span data-test='item'>{ch}</span>)}
				</False>
			</Either>
		)
		renderApp(container, h(App))
		const rendered = [...container.querySelectorAll('[data-test="item"]')].map(el=> el.textContent)
		expect(rendered).toEqual(['x', 'y'])
	})

	it('renders array spread children in True branch', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)

		const App = ()=> (
			<Either condition={true}>
				<True>
					{[<span data-test='item'>A</span>, <span data-test='item'>B</span>]}
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		const rendered = [...container.querySelectorAll('[data-test="item"]')].map(el=> el.textContent)
		expect(rendered).toEqual(['A', 'B'])
	})

	it('array children survive reactive condition flips', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const cond = createSignal(true)
		const items = ['a', 'b', 'c']

		const App = ()=> (
			<Either condition={cond}>
				<True>
					{items.map((ch)=> <span data-test='item'>{ch}</span>)}
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		expect([...container.querySelectorAll('[data-test="item"]')]).toHaveLength(3)

		cond(false)
		expect(container.querySelector('[data-test="off"]')).not.toBeNull()
		expect(container.querySelector('[data-test="item"]')).toBeNull()

		cond(true)
		const rendered = [...container.querySelectorAll('[data-test="item"]')].map(el=> el.textContent)
		expect(rendered).toEqual(['a', 'b', 'c'])
	})

	it('array children do not leak nodes across condition flips', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const cond = createSignal(true)
		const items = ['a', 'b', 'c']

		const App = ()=> (
			<Either condition={cond}>
				<True>
					{items.map((ch)=> <span data-test='item'>{ch}</span>)}
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		// Flip several times — no node accumulation
		for (let i = 0; i < 5; i++){
			cond(!cond())
		}
		cond(true)
		const rendered = [...container.querySelectorAll('[data-test="item"]')].map(el=> el.textContent)
		expect(rendered).toEqual(['a', 'b', 'c'])
		expect(container.querySelectorAll('span').length).toBe(3)
	})

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

describe('Either short-circuit', ()=> {
	it('preserves branch DOM identity when condition toggles between two truthy values', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const cond = createSignal(1)

		const App = ()=> (
			<Either condition={()=> Boolean(cond())}>
				<True>
					<span data-test='on'>on</span>
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		const initial = container.querySelector('[data-test="on"]')
		expect(initial).not.toBeNull()

		// Condition signal changes but resolves to same branch (truthy → truthy).
		cond(2)
		expect(container.querySelector('[data-test="on"]')).toBe(initial)

		cond(3)
		expect(container.querySelector('[data-test="on"]')).toBe(initial)

		// Flipping to falsy must actually swap the branch.
		cond(0)
		expect(container.querySelector('[data-test="on"]')).toBeNull()
		expect(container.querySelector('[data-test="off"]')).not.toBeNull()
	})

	it('does not dispose the branch owner when an unrelated read in the selector changes', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const cond = createSignal(true)
		const tick = createSignal(0)
		let cleanupCount = 0

		const Inner = ()=> {
			// Registered against the branch owner via JSX bindings — if branch is
			// re-rendered, this element gets replaced.
			return <span data-test='inner'>{tick}</span>
		}

		const App = ()=> (
			<Either condition={()=> {
				tick() // selector reads tick but branch identity only depends on cond
				return cond()
			}}>
				<True>
					<Inner />
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		const inner = container.querySelector('[data-test="inner"]')
		expect(inner).not.toBeNull()

		tick(1)
		tick(2)
		tick(3)
		// Same branch — element identity should survive.
		expect(container.querySelector('[data-test="inner"]')).toBe(inner)
		expect(cleanupCount).toBe(0)
	})
})

describe('Either deferred descriptors', ()=> {
	it('flushes component descriptors when branch returns an array of components', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const Item = ({ label })=> <span data-test='item'>{label}</span>
		const labels = ['x', 'y', 'z']

		const App = ()=> (
			<Either condition={true}>
				<True>
					{labels.map((label)=> <Item label={label} />)}
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		const rendered = [...container.querySelectorAll('[data-test="item"]')].map(el=> el.textContent)
		expect(rendered).toEqual(['x', 'y', 'z'])
	})

	it('flushes component descriptors after a reactive branch flip back', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const cond = createSignal(true)
		const Item = ({ label })=> <span data-test='item'>{label}</span>

		const App = ()=> (
			<Either condition={cond}>
				<True>
					{['a', 'b'].map((label)=> <Item label={label} />)}
				</True>
				<False>
					<span data-test='off'>off</span>
				</False>
			</Either>
		)
		renderApp(container, h(App))
		expect([...container.querySelectorAll('[data-test="item"]')]).toHaveLength(2)
		cond(false)
		expect(container.querySelectorAll('[data-test="item"]').length).toBe(0)
		cond(true)
		const rendered = [...container.querySelectorAll('[data-test="item"]')].map(el=> el.textContent)
		expect(rendered).toEqual(['a', 'b'])
	})
})

describe('Match cases as function', ()=> {
	it('invokes the cases function on every selection pass', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const which = createSignal(0)
		let casesCalls = 0

		const buildCases = ()=> {
			casesCalls++
			return [
				{ when: 0, branch: ()=> h('span', { 'data-test': 'a' }, 'A') },
				{ when: 1, branch: ()=> h('span', { 'data-test': 'b' }, 'B') },
			]
		}

		const App = ()=> h(Match, {
			value: which,
			cases: buildCases,
		})
		renderApp(container, h(App))
		expect(container.querySelector('[data-test="a"]').textContent).toBe('A')
		const callsAfterInitial = casesCalls
		expect(callsAfterInitial).toBeGreaterThanOrEqual(1)

		which(1)
		expect(container.querySelector('[data-test="b"]').textContent).toBe('B')
		expect(casesCalls).toBeGreaterThan(callsAfterInitial)
	})

	it('re-renders when cases function returns fresh branch identities even for the same value', ()=> {
		const container = document.createElement('div')
		document.body.appendChild(container)
		const payload = createSignal('first')
		let renderedTimes = 0

		const cases = ()=> {
			// New branch closure on every call → identity changes → mountDynamic
			// will tear down and rebuild even when `value` stays at 0.
			const current = payload()
			return [{
				when: 0,
				branch: ()=> {
					renderedTimes++
					return h('span', { 'data-test': 'p' }, current)
				},
			}]
		}

		const App = ()=> h(Match, {
			value: 0,
			cases,
		})
		renderApp(container, h(App))
		expect(container.querySelector('[data-test="p"]').textContent).toBe('first')
		expect(renderedTimes).toBe(1)

		payload('second')
		expect(container.querySelector('[data-test="p"]').textContent).toBe('second')
		expect(renderedTimes).toBe(2)
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
