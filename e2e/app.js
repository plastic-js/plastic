import {
	h,
	renderApp,
	onMount,
	onCleanup,
	Either,
	True,
	False,
	createSignal,
} from '@plastic-js/plastic'

const results = {}

const makeContainer = (id) => {
	const el = document.createElement('div')
	el.id = id
	document.getElementById('root').appendChild(el)
	return el
}

// ── Scenario: native root wrapping component with onMount ──
{
	const mountSpy = []
	const cleanupSpy = []
	const Inner = () => {
		onMount(() => mountSpy.push('mounted'))
		onCleanup(() => cleanupSpy.push('cleaned'))
		return h('span', null, 'inner')
	}

	const container = makeContainer('scenario-native-root')
	const dispose = renderApp(container, h('div', { class: 'wrapper' }, h(Inner)))

	results['native-root'] = {
		text: container.textContent,
		mountCalls: mountSpy.length,
		mountOrder: mountSpy.join(','),
	}
}

// ── Scenario: native root + mountDynamic (Either) ──
{
	const mountSpy = []
	const Branch = () => {
		onMount(() => mountSpy.push('branch-mounted'))
		return h('p', null, 'either-branch')
	}

	const App = () => h('section', { class: 'either-wrapper' }, h(Either, {
		condition: true,
		trueBranch: () => h(True, null, h(Branch)),
		falseBranch: () => h('span', null, 'fallback'),
	}))

	const container = makeContainer('scenario-either')
	renderApp(container, h('div', { class: 'root' }, h(App)))

	results['native-root-either'] = {
		text: container.textContent,
		mountCalls: mountSpy.length,
	}
}

// ── Scenario: component root (control — should still work) ──
{
	const mountSpy = []
	const Comp = () => {
		onMount(() => mountSpy.push('mounted'))
		return h('span', null, 'control')
	}

	const container = makeContainer('scenario-component-root')
	renderApp(container, h(Comp))

	results['component-root'] = {
		text: container.textContent,
		mountCalls: mountSpy.length,
	}
}

// ── Scenario: detached container (should NOT fire onMount) ──
{
	const mountSpy = []
	const Comp = () => {
		onMount(() => mountSpy.push('should-not-fire'))
		return h('b', null, 'detached')
	}

	const container = document.createElement('div')
	container.id = 'scenario-detached'
	renderApp(container, h('div', null, h(Comp)))

	results['detached-native-root'] = {
		text: container.textContent,
		mountCalls: mountSpy.length,
	}
}

// ── Scenario: native root + dispose cleans up ──
{
	const mountSpy = []
	const cleanupSpy = []
	const Comp = () => {
		onMount(() => mountSpy.push('mounted'))
		onCleanup(() => cleanupSpy.push('cleaned'))
		return h('span', null, 'disposable')
	}

	const container = makeContainer('scenario-dispose')
	const dispose = renderApp(container, h('div', null, h(Comp)))
	const textBefore = container.textContent
	dispose()

	results['native-root-dispose'] = {
		textBeforeDispose: textBefore,
		childCountAfter: container.childNodes.length,
		mountCalls: mountSpy.length,
		cleanupCalls: cleanupSpy.length,
	}
}

// ── Scenario: nested native wrappers + deep component ──
{
	const mountSpy = []
	const Deep = () => {
		onMount(() => mountSpy.push('deep-mounted'))
		return h('i', null, 'deep')
	}

	const container = makeContainer('scenario-deep-nested')
	renderApp(container, h('main', null, h('section', null, h('div', null, h(Deep)))))

	results['deep-nested-native'] = {
		text: container.textContent,
		mountCalls: mountSpy.length,
	}
}

// ── Scenario: sibling components under native root ──
{
	const mountA = []
	const mountB = []
	const A = () => {
		onMount(() => mountA.push('A'))
		return h('span', null, 'A')
	}
	const B = () => {
		onMount(() => mountB.push('B'))
		return h('span', null, 'B')
	}

	const container = makeContainer('scenario-siblings')
	renderApp(container, h('div', null, h(A), h(B)))

	results['sibling-components'] = {
		text: container.textContent,
		mountA: mountA.length,
		mountB: mountB.length,
	}
}

window.__e2e = results
