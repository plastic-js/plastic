// @vitest-environment jsdom

import {
	afterEach, describe, expect, it,
} from 'vitest'
import { transformSync } from '@babel/core'
import {
	Dynamic,
	createTree,
	h,
	renderApp,
} from '../src/jsx-runtime.js'
import transformReactivePlugin from '../build/babel-plugin-transform-jsx-reactive.js'
import transformControlFlowPlugin from '../build/babel-plugin-transform-jsx-control-flow.js'

describe('babel plugin: Either slot lazy transform', ()=> {
	it('rewrites <Either><True/><False/></Either> children into trueBranch/falseBranch factory props', ()=> {
		const source = `
			const view = (
				<Either condition={flag()}>
					<True><p>A</p></True>
					<False><p>B</p></False>
				</Either>
			)
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformControlFlowPlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('trueBranch: () =>')
		expect(code).toContain('falseBranch: () =>')
		expect(code).not.toContain('children: [')
	})
})

describe('babel plugin: Context.Provider lazy transform', ()=> {
	it('rewrites Provider children to a lazy children factory prop', ()=> {
		const source = `
			const Theme = createContext('light')
			const view = (
				<Theme.Provider value="dark">
					<p>A</p>
				</Theme.Provider>
			)
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformControlFlowPlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () =>')
		expect(code).not.toContain('children: [')
	})
})

describe('babel plugin: ternary lazy transform', ()=> {
	it('wraps JSX ternary expressions in a lazy factory function', ()=> {
		const source = `
			const view = <section>{flag() ? <p>A</p> : <p>B</p>}</section>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => flag() ?')
	})

	it('wraps member-expression children in a lazy factory function', ()=> {
		const source = `
			const view = <section>{state.count}</section>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => state.count')
	})

	it('wraps intrinsic DOM attributes when their expression is dynamic', ()=> {
		const source = `
			const view = <div style={{ color: state.color }} title={state.title} />
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('style: () => ({')
		expect(code).toContain('color: state.color')
		expect(code).toContain('title: () => state.title')
	})

	it('wraps dynamic component props and wraps dynamic event handlers in indirection closure', ()=> {
		const source = `
			const view = <><Button label={state.label} /><button onClick={handlers.save} disabled={locked} /></>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		// component prop with dynamic MemberExpression — should be wrapped
		expect(code).toContain('label: () => state.label')
		// intrinsic event handler with dynamic MemberExpression — wrapped in indirection closure
		expect(code).toContain('const _fn = handlers.save')
		expect(code).toContain('_fn?.')
		// static identifier on intrinsic element — must not be wrapped
		expect(code).toContain('disabled: locked')
		expect(code).not.toContain('disabled: () => locked')
	})

	it('wraps dynamic intrinsic event handler expressions in indirection closure', ()=> {
		const source = `
			const view = <button onClick={flag() ? () => alert("A") : () => alert("B")}>Toggle</button>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		// dynamic conditional event handler — wrapped so function resolves at call time
		expect(code).toContain('const _fn = flag() ?')
		expect(code).toContain('_fn?.')
		expect(code).not.toContain('onClick: () => flag() ?')
	})

	it('does not wrap arrow-function or function-expression children', ()=> {
		const source = `
			const view = <div>{() => x}{function handler() { return x }}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).not.toContain('() => () => x')
		expect(code).not.toContain('() => function handler')
	})

	it('wraps plain function-call children', ()=> {
		const source = `
			const view = <div>{count()}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => count()')
	})

	it('wraps identifier used as a call argument when parent expression is a call (fn(foo))', ()=> {
		const source = `
			const view = <div>{fn(foo)}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => fn(foo)')
	})

	it('does not wrap standalone function-reference identifier children (fn)', ()=> {
		const source = `
			const view = <div>{fn}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: fn')
		expect(code).not.toContain('children: () => fn')
	})

	it('wraps optional-call children', ()=> {
		const source = `
			const view = <div>{count?.()}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => count?.()')
	})

	it('wraps tagged-template-literal children', ()=> {
		const source = `
			const view = <div>{t\`Hello\`}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('() => t`Hello`')
	})

	it('wraps intrinsic attribute whose object value contains a spread element', ()=> {
		const source = `
			const view = <div style={{...styles}} />
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('style: () => ({')
	})

	it('wraps a nested JSX element used as a child expression', ()=> {
		const source = `
			const view = <div>{<span>text</span>}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () =>')
	})

	it('wraps a non-empty fragment used as a child expression', ()=> {
		const source = `
			const view = <div>{<><span /><p /></>}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () =>')
	})

	it('does not wrap an empty fragment used as a child expression', ()=> {
		const source = `
			const view = <div>{<></>}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).not.toContain('children: () =>')
	})

	it('does not wrap literal children (number, string, null)', ()=> {
		const source = `
			const view = <div>{123}{"text"}{null}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).not.toContain('() => 123')
		expect(code).not.toContain('() => "text"')
		expect(code).not.toContain('() => null')
	})

	it('wraps update-expression children (count++)', ()=> {
		const source = `
			const view = <div>{count++}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => count++')
	})

	it('wraps assignment-expression children (state.value = 1)', ()=> {
		const source = `
			const view = <div>{state.value = 1}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => state.value = 1')
	})

	it('wraps logical-expression children when any operand is dynamic (flag() && value)', ()=> {
		const source = `
			const view = <div>{flag() && value}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => flag() && value')
	})

	it('does not wrap logical-expression children when all operands are static identifiers (flag && value)', ()=> {
		const source = `
			const view = <div>{flag && value}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).not.toContain('() => flag && value')
	})

	it('wraps conditional-expression children when any branch is dynamic (a ? state.b : c)', ()=> {
		const source = `
			const view = <div>{a ? state.b : c}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => a ? state.b : c')
	})

	it('does not wrap conditional-expression children when all branches are static identifiers (a ? b : c)', ()=> {
		const source = `
			const view = <div>{a ? b : c}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).not.toContain('() => a ? b : c')
	})

	it('wraps binary-expression children when one member is dynamic (a() + b)', ()=> {
		const source = `
			const view = <div>{a() + b}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => a() + b')
	})

	it('does not wrap binary-expression children when both members are static identifiers (foo + bar)', ()=> {
		const source = `
			const view = <div>{foo + bar}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).not.toContain('children: () => foo + bar')
	})

	it('wraps unary-expression children when operand is dynamic (!x())', ()=> {
		const source = `
			const view = <div>{!x()}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => !x()')
	})

	it('wraps array-expression children when one member is dynamic ([a(), 1])', ()=> {
		const source = `
			const view = <div>{[a(), 1]}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => [a(), 1]')
	})

	it('wraps object-expression children when one value is dynamic ({ x: value() })', ()=> {
		const source = `
			const view = <div>{{ x: value() }}</div>
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => ({')
		expect(code).toContain('x: value()')
	})

	it('wraps template-literal children when one interpolation member is dynamic (`Hello ${name()}`)', ()=> {
		const source = '\n\t\t\tconst view = <div>{`Hello ${name()}`}</div>\n\t\t'

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('children: () => `Hello ${name()}`')
	})
})

describe('babel plugin: Match slot lazy transform', ()=> {
	it('rewrites <Match><Case/><Default/></Match> children into case/default factory props', ()=> {
		const source = `
			const view = (
				<Match value={state()}>
					<Case when="idle"><p>Idle</p></Case>
					<Default><p>Fallback</p></Default>
				</Match>
			)
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformControlFlowPlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('cases: [')
		expect(code).toContain('branch: () =>')
		expect(code).toContain('defaultBranch: () =>')
		expect(code).not.toContain('children: [')
	})
})

describe('babel plugin: createTree reactivity in compiled components', ()=> {
	afterEach(()=> {
		document.body.innerHTML = ''
	})

	const compileComponent = (source)=> {
		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'classic',
					pragma: 'h',
					pragmaFrag: 'Fragment',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''
		const factory = new Function('h', 'Fragment', `${code}; return App;`)

		return {
			code,
			App: factory(h, Symbol('Fragment')),
		}
	}

	it('updates child text when createTree fields change in a compiled component', ()=> {
		const { code, App } = compileComponent(`
			const App = ({ state }) => <section>Count: {state.count}</section>
		`)
		const state = createTree({
			count: 1,
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		expect(code).toContain('"Count: ", () => state.count')
		expect(container.textContent).toBe('Count: 1')

		state.count = 2

		expect(container.textContent).toBe('Count: 2')
	})

	it('updates intrinsic attributes from createTree fields in a compiled component', ()=> {
		const { code, App } = compileComponent(`
			const App = ({ state }) => <input title={state.meta.title} value={state.form.value} />
		`)
		const state = createTree({
			meta: {
				title: 'draft',
			},
			form: {
				value: 'A',
			},
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const input = container.querySelector('input')

		expect(code).toContain('title: () => state.meta.title')
		expect(code).toContain('value: () => state.form.value')
		expect(input.getAttribute('title')).toBe('draft')
		expect(input.value).toBe('A')

		state.meta.title = 'published'
		state.form.value = 'B'

		expect(input.getAttribute('title')).toBe('published')
		expect(input.value).toBe('B')
	})

	it('updates ternary child branches driven by createTree fields in a compiled component', ()=> {
		const { code, App } = compileComponent(`
			const App = ({ state }) => <p>{state.done ? state.labels.done : state.labels.todo}</p>
		`)
		const state = createTree({
			done: false,
			labels: {
				done: 'Done',
				todo: 'Todo',
			},
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		expect(code).toContain('() => state.done ? state.labels.done : state.labels.todo')
		expect(container.textContent).toBe('Todo')

		state.done = true
		expect(container.textContent).toBe('Done')

		state.labels.done = 'Completed'
		expect(container.textContent).toBe('Completed')
	})

	it('updates array-derived values from createTree after push in a compiled component', ()=> {
		const { App } = compileComponent(`
			const App = ({ state }) => <div>Total: {state.items.length}</div>
		`)
		const state = createTree({
			items: ['a', 'b'],
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		expect(container.textContent).toBe('Total: 2')

		state.items.push('c')

		expect(container.textContent).toBe('Total: 3')
	})

	it('tracks optional chaining and nullish fallback from createTree in children and attributes', ()=> {
		const { code, App } = compileComponent(`
			const App = ({ state }) => <p title={state.user?.name ?? 'anonymous'}>{state.user?.name ?? 'anonymous'}</p>
		`)
		const state = createTree({
			user: {
				name: 'Ada',
			},
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const paragraph = container.querySelector('p')

		expect(code).toContain('title: () => state.user?.name ?? \'anonymous\'')
		expect(code).toContain(', () => state.user?.name ?? \'anonymous\'')
		expect(paragraph.getAttribute('title')).toBe('Ada')
		expect(paragraph.textContent).toBe('Ada')

		state.user.name = 'Grace'
		expect(paragraph.getAttribute('title')).toBe('Grace')
		expect(paragraph.textContent).toBe('Grace')

		state.user = null
		expect(paragraph.getAttribute('title')).toBe('anonymous')
		expect(paragraph.textContent).toBe('anonymous')

		state.user = {
			name: 'Linus',
		}
		expect(paragraph.getAttribute('title')).toBe('Linus')
		expect(paragraph.textContent).toBe('Linus')
	})

	it('clears removed style keys when style object is compiled from createTree fields', ()=> {
		const { code, App } = compileComponent(`
			const App = ({ state }) => <div style={{ color: state.styles.color, ...(state.styles.fontSize ? { fontSize: state.styles.fontSize } : {}) }} />
		`)
		const state = createTree({
			styles: {
				color: 'red',
				fontSize: '14px',
			},
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const element = container.querySelector('div')

		expect(code).toContain('style: () => ({')
		expect(code).toContain('color: state.styles.color')
		expect(code).toContain('state.styles.fontSize ? {')
		expect(element.style.color).toBe('red')
		expect(element.style.fontSize).toBe('14px')

		state.styles.color = 'blue'
		state.styles.fontSize = ''

		expect(element.style.color).toBe('blue')
		expect(element.style.fontSize).toBe('')
	})

	it('reacts to createTree sparse index updates and length shrink in compiled JSX children', ()=> {
		const { code, App } = compileComponent(`
			const App = ({ state }) => <p>Item: {state.items[2] ?? 'empty'}</p>
		`)
		const state = createTree({
			items: ['A'],
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		expect(code).toContain('() => state.items[2] ?? \'empty\'')
		expect(container.textContent).toBe('Item: empty')

		state.items[2] = 'C'
		expect(container.textContent).toBe('Item: C')

		state.items.length = 1
		expect(container.textContent).toBe('Item: empty')
	})

	it('keeps createTree proxy reactive across component boundaries in compiled components', ()=> {
		const { code, App } = compileComponent(`
			const Child = ({ state }) => <span>{state.profile.name}</span>
			const App = ({ state }) => <section><Child state={state} /></section>
		`)
		const state = createTree({
			profile: {
				name: 'Ada',
			},
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		expect(code).toContain(', () => state.profile.name')
		expect(container.textContent).toBe('Ada')

		state.profile.name = 'Grace'
		expect(container.textContent).toBe('Grace')

		state.profile = {
			name: 'Linus',
		}
		expect(container.textContent).toBe('Linus')
	})

	it('treats identifier tree child as static and renders placeholder comment', ()=> {
		const { code, App } = compileComponent(`
			const App = ({ state }) => <div>{state}</div>
		`)
		const state = createTree({
			count: 1,
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const host = container.querySelector('div')

		expect(code).toContain('h("div", null, state)')
		expect(code).not.toContain('() => state')
		expect(host.childNodes).toHaveLength(1)
		expect(host.firstChild.nodeType).toBe(Node.COMMENT_NODE)
		expect(host.innerHTML).toBe('<!--null-->')

		state.count = 2
		expect(host.innerHTML).toBe('<!--null-->')
	})

	it('does not wrap identifier intrinsic props carrying tree objects', ()=> {
		const { code, App } = compileComponent(`
			const App = ({ styles, model }) => (
				<section>
					<div style={styles}>Card</div>
					<input value={model} />
				</section>
			)
		`)
		const styles = createTree({
			color: 'red',
		})
		const model = createTree({
			value: 'A',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			styles,
			model,
		}))

		const card = container.querySelector('div')
		const input = container.querySelector('input')

		expect(code).toContain('style: styles')
		expect(code).not.toContain('style: () => styles')
		expect(code).toContain('value: model')
		expect(code).not.toContain('value: () => model')
		expect(card.style.color).toBe('red')
		expect(input.value).toBe('[object Object]')

		styles.color = 'blue'
		model.value = 'B'

		expect(card.style.color).toBe('red')
		expect(input.value).toBe('[object Object]')
	})

	it('wraps dynamic component props as accessor thunks so createTree field updates are reactive', ()=> {
		const { code, App } = compileComponent(`
			const Child = ({ label }) => <span>{label}</span>
			const App = ({ state }) => <Child label={state.label} />
		`)
		const state = createTree({
			label: 'Todo',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		expect(code).toContain('label: () => state.label')
		expect(container.textContent).toBe('Todo')

		state.label = 'Done'
		expect(container.textContent).toBe('Done')
	})

	it('wraps Dynamic component prop as accessor thunk so tag updates from createTree are reactive', ()=> {
		const source = `
			const App = ({ state }) => <Dynamic component={state.tag}>Value</Dynamic>
		`
		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'classic',
					pragma: 'h',
					pragmaFrag: 'Fragment',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''
		const factory = new Function('h', 'Fragment', 'Dynamic', `${code}; return App;`)
		const App = factory(h, Symbol('Fragment'), Dynamic)

		const state = createTree({
			tag: 'span',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		expect(code).toContain('component: () => state.tag')
		expect(container.firstChild.tagName).toBe('SPAN')

		state.tag = 'strong'
		expect(container.firstChild.tagName).toBe('SPAN')
		expect(container.firstChild.textContent).toBe('Value')
	})
})

describe('babel plugin: reactive spread', ()=> {
	afterEach(()=> {
		document.body.innerHTML = ''
	})

	it('rewrites a non-static JSX spread into an __rspread__N thunk prop', ()=> {
		const source = `
			const view = <div a={1} {...api().getRootProps()} b={2} />
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('__rspread__0: () => api().getRootProps()')
		expect(code).not.toContain('...api()')
	})

	it('numbers multiple spreads on the same element distinctly', ()=> {
		const source = `
			const view = <div {...one()} {...two()} />
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('__rspread__0: () => one()')
		expect(code).toContain('__rspread__1: () => two()')
	})

	it('leaves a static object-literal spread untouched', ()=> {
		const source = `
			const view = <div {...{ id: 'x', title: 'y' }} />
		`

		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'automatic',
					importSource: 'plastic',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).not.toContain('__rspread__')
	})

	it('updates DOM attributes when the spread source returns new values', ()=> {
		const source = `
			const App = ({ state }) => <div {...({ 'data-value': state.value, title: state.title })} />
		`
		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'classic',
					pragma: 'h',
					pragmaFrag: 'Fragment',
				},
			]],
			plugins: [transformReactivePlugin],
		})
		const code = transformed?.code ?? ''
		const factory = new Function('h', 'Fragment', `${code}; return App;`)
		const App = factory(h, Symbol('Fragment'))

		const state = createTree({
			value: '1',
			title: 'first',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const el = container.querySelector('div')

		expect(code).toContain('__rspread__0: () =>')
		expect(el.getAttribute('data-value')).toBe('1')
		expect(el.getAttribute('title')).toBe('first')

		state.value = '2'
		state.title = 'second'

		expect(el.getAttribute('data-value')).toBe('2')
		expect(el.getAttribute('title')).toBe('second')
	})

	it('clears attributes that drop out of the spread on a later run', ()=> {
		const source = `
			const App = ({ state }) => <div {...state.props} />
		`
		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'classic',
					pragma: 'h',
					pragmaFrag: 'Fragment',
				},
			]],
			plugins: [transformReactivePlugin],
		})
		const code = transformed?.code ?? ''
		const factory = new Function('h', 'Fragment', `${code}; return App;`)
		const App = factory(h, Symbol('Fragment'))

		const state = createTree({
			props: {
				title: 'hello',
				'data-x': '1',
			},
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const el = container.querySelector('div')

		expect(el.getAttribute('title')).toBe('hello')
		expect(el.getAttribute('data-x')).toBe('1')

		state.props = {
			title: 'world',
		}

		expect(el.getAttribute('title')).toBe('world')
		expect(el.hasAttribute('data-x')).toBe(false)
	})

	it('swaps event handlers across spread re-evaluations', ()=> {
		const source = `
			const App = ({ state }) => <button {...({ onClick: state.handler })}>x</button>
		`
		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'classic',
					pragma: 'h',
					pragmaFrag: 'Fragment',
				},
			]],
			plugins: [transformReactivePlugin],
		})
		const code = transformed?.code ?? ''
		const factory = new Function('h', 'Fragment', `${code}; return App;`)
		const App = factory(h, Symbol('Fragment'))

		let calls = []
		const state = createTree({
			handler: ()=> calls.push('a'),
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const btn = container.querySelector('button')
		btn.click()
		expect(calls).toEqual(['a'])

		state.handler = ()=> calls.push('b')
		btn.click()
		expect(calls).toEqual(['a', 'b'])
	})

	it('lets static props after a spread override its keys', ()=> {
		const source = `
			const App = ({ state }) => <div {...({ 'data-x': state.value })} data-x="fixed" />
		`
		const transformed = transformSync(source, {
			configFile: false,
			babelrc: false,
			presets: [[
				'@babel/preset-react',
				{
					runtime: 'classic',
					pragma: 'h',
					pragmaFrag: 'Fragment',
				},
			]],
			plugins: [transformReactivePlugin],
		})
		const code = transformed?.code ?? ''
		const factory = new Function('h', 'Fragment', `${code}; return App;`)
		const App = factory(h, Symbol('Fragment'))

		const state = createTree({
			value: 'from-spread',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const el = container.querySelector('div')

		expect(el.getAttribute('data-x')).toBe('fixed')
	})

	// ── Compile-time: spread-argument wrapping decisions ──────────────────────

	it('passes an identifier spread directly to mergeProps (no thunk — tree Proxy handles reactivity via its own traps)', ()=> {
		const code = compileWithAutomatic(`const view = <div {...obj} />`)

		expect(code).toContain('mergeProps(obj)')
		expect(code).not.toContain('() => obj')
	})

	it('wraps a member-expression spread in a thunk', ()=> {
		const code = compileWithAutomatic(`const view = <div {...store.props} />`)

		expect(code).toContain('() => store.props')
	})

	it('wraps an optional-member-expression spread in a thunk', ()=> {
		const code = compileWithAutomatic(`const view = <div {...state?.rest} />`)

		expect(code).toContain('() => state?.rest')
	})

	it('wraps a deeply chained member-expression spread in a thunk', ()=> {
		const code = compileWithAutomatic(`const view = <div {...a.b.c} />`)

		expect(code).toContain('() => a.b.c')
	})

	it('does not wrap a ternary spread when all branches are static identifiers', ()=> {
		const code = compileWithAutomatic(`const view = <div {...(flag ? a : b)} />`)

		expect(code).not.toContain('() => flag')
		expect(code).toContain('flag ? a : b')
	})

	it('wraps a ternary spread when one branch is a dynamic call expression', ()=> {
		const code = compileWithAutomatic(`const view = <div {...(flag ? api() : defaults)} />`)

		expect(code).toContain('() => flag ? api() : defaults')
	})

	it('does not wrap a logical-expression spread when both operands are static identifiers', ()=> {
		const code = compileWithAutomatic(`const view = <div {...(a || b)} />`)

		expect(code).not.toContain('() => a || b')
		expect(code).toContain('a || b')
	})

	it('wraps a logical-expression spread when one operand is a dynamic member access', ()=> {
		const code = compileWithAutomatic(`const view = <div {...(state.extra || {})} />`)

		expect(code).toContain('() => state.extra || {}')
	})

	it('wraps an object-literal spread that contains an inner spread element', ()=> {
		const code = compileWithAutomatic(`const view = <div {...{ ...extra }} />`)

		expect(code).toContain('...extra')
		expect(code).toMatch(/\(\)\s*=>/)
	})

	it('wraps an object-literal spread whose property value is a dynamic call expression', ()=> {
		const code = compileWithAutomatic(`const view = <div {...{ x: computed() }} />`)

		expect(code).toContain('x: computed()')
		expect(code).toMatch(/\(\)\s*=>/)
	})

	it('passes an inline arrow-function spread directly without double-wrapping', ()=> {
		const code = compileWithAutomatic(`const view = <div {...(() => baseProps)} />`)

		expect(code).not.toContain('() => () =>')
		expect(code).toContain('() => baseProps')
	})

	it('passes a null spread directly as a plain mergeProps arg (static literal)', ()=> {
		const code = compileWithAutomatic(`const view = <div {...null} />`)

		expect(code).toContain('mergeProps(null)')
		expect(code).not.toMatch(/\(\)\s*=>\s*null/)
	})

	// ── Compile-time: argument grouping and ordering ──────────────────────────

	it('groups consecutive non-spread attrs and keeps each spread as a separate positional arg', ()=> {
		const code = compileWithAutomatic(`const view = <div a={1} {...s1()} b={2} c={3} {...s2()} d={4} />`)

		expect(code).toContain('a: 1')
		expect(code).toContain('() => s1()')
		expect(code).toContain('b: 2')
		expect(code).toContain('c: 3')
		expect(code).toContain('() => s2()')
		expect(code).toContain('d: 4')

		// b and c must share the same object group — no thunk between them
		const bIdx = code.indexOf('b: 2')
		const cIdx = code.indexOf('c: 3')
		const betweenBC = code.slice(Math.min(bIdx, cIdx), Math.max(bIdx, cIdx))
		expect(betweenBC).not.toContain('() =>')
	})

	it('emits a leading spread thunk before the trailing attrs object', ()=> {
		const code = compileWithAutomatic(`const view = <div {...api()} id="x" />`)

		expect(code).toContain('() => api()')
		expect(code).toContain('id: "x"')
		expect(code.indexOf('() => api()')).toBeLessThan(code.indexOf('id: "x"'))
	})

	it('emits a leading attrs object before the trailing spread thunk', ()=> {
		const code = compileWithAutomatic(`const view = <div id="x" {...api()} />`)

		expect(code).toContain('id: "x"')
		expect(code).toContain('() => api()')
		expect(code.indexOf('id: "x"')).toBeLessThan(code.indexOf('() => api()'))
	})

	it('skips mergeProps entirely and emits jsx(Tag, {}) when there are no attrs and no children', ()=> {
		const code = compileWithAutomatic(`const view = <MyComp />`)

		expect(code).not.toContain('mergeProps')
		expect(code).toMatch(/jsx\(MyComp,\s*\{\}/)
	})

	it('attaches children to the last object group when that group holds regular attrs', ()=> {
		const code = compileWithAutomatic(`const view = <Comp a={1}>{child}</Comp>`)

		// a:1 and children:child must share the same object literal — no thunk between them
		const aIdx = code.indexOf('a: 1')
		const chIdx = code.indexOf('children: child')
		const between = code.slice(Math.min(aIdx, chIdx), Math.max(aIdx, chIdx))
		expect(between).not.toContain('() =>')
	})

	it('creates a separate trailing object group for children when the last arg is a spread', ()=> {
		const code = compileWithAutomatic(`const view = <Comp {...api()}>{child}</Comp>`)

		const thunkIdx = code.indexOf('() => api()')
		const childrenIdx = code.indexOf('children: child')
		expect(thunkIdx).toBeGreaterThan(-1)
		expect(childrenIdx).toBeGreaterThan(thunkIdx)
	})

	it('creates a children-only trailing group when there are no attrs', ()=> {
		const code = compileWithAutomatic(`const view = <Comp>{child}</Comp>`)

		expect(code).toContain('mergeProps(')
		expect(code).toContain('children: child')
	})

	it('emits aria-* attribute keys as quoted string literals inside the object group', ()=> {
		const code = compileWithAutomatic(`const view = <div {...api()} aria-label="close" aria-hidden={hidden} />`)

		expect(code).toContain('"aria-label"')
		expect(code).toContain('"aria-hidden"')
	})

	it('emits data-* attribute keys as quoted string literals', ()=> {
		const code = compileWithAutomatic(`const view = <div {...api()} data-testid="btn" />`)

		expect(code).toContain('"data-testid"')
	})

	it('emits a boolean-shorthand attribute as a plain true property, not a getter', ()=> {
		const code = compileWithAutomatic(`const view = <button disabled {...api()} />`)

		expect(code).toContain('disabled: true')
		expect(code).not.toContain('get disabled()')
	})
})

describe('babel plugin: attribute spread – runtime behavior edge cases', ()=> {
	afterEach(()=> {
		document.body.innerHTML = ''
	})

	it('last-wins: second spread overrides first when both carry the same key', ()=> {
		const { App } = compileComponent(`
			const App = () => <div {...({ 'data-x': 'first' })} {...({ 'data-x': 'second' })} />
		`)
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {}))

		expect(container.querySelector('div').getAttribute('data-x')).toBe('second')
	})

	it('a spread placed after an explicit attr overrides that attr and stays reactive', ()=> {
		const { App } = compileComponent(`
			const App = ({ state }) => <div data-x="base" {...({ 'data-x': state.value })} />
		`)
		const state = createTree({
			value: 'override',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const el = container.querySelector('div')
		expect(el.getAttribute('data-x')).toBe('override')

		state.value = 'updated'
		expect(el.getAttribute('data-x')).toBe('updated')
	})

	it('concatenates class values from spread and explicit class attr', ()=> {
		const { App } = compileComponent(`
			const App = () => <div {...({ class: 'spread-cls' })} class="extra-cls" />
		`)
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {}))

		const el = container.querySelector('div')
		expect(el.className).toContain('spread-cls')
		expect(el.className).toContain('extra-cls')
	})

	it('updates one spread class independently without disturbing class from a sibling spread', ()=> {
		const { App } = compileComponent(`
			const App = ({ s1, s2 }) => <div {...({ class: s1.cls })} {...({ class: s2.cls })} />
		`)
		const s1 = createTree({
			cls: 'a',
		})
		const s2 = createTree({
			cls: 'b',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			s1,
			s2,
		}))

		const el = container.querySelector('div')
		expect(el.className).toContain('a')
		expect(el.className).toContain('b')

		s1.cls = 'c'
		expect(el.className).toContain('c')
		expect(el.className).toContain('b')
	})

	it('merges style objects from spread and explicit style attr, reacting to spread changes', ()=> {
		const { App } = compileComponent(`
			const App = ({ state }) => <div {...({ style: { color: state.color } })} style={{ fontWeight: 'bold' }} />
		`)
		const state = createTree({
			color: 'red',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const el = container.querySelector('div')
		expect(el.style.color).toBe('red')
		expect(el.style.fontWeight).toBe('bold')

		state.color = 'blue'
		expect(el.style.color).toBe('blue')
		expect(el.style.fontWeight).toBe('bold')
	})

	it('composes onClick handlers from spread and explicit attr, invoking both in source order', ()=> {
		const calls = []
		const { App } = compileComponent(`
			const App = ({ h1, h2 }) => <button {...({ onClick: h1 })} onClick={h2}>x</button>
		`)
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			h1: ()=> calls.push('spread'),
			h2: ()=> calls.push('explicit'),
		}))

		container.querySelector('button').click()
		expect(calls).toEqual(['spread', 'explicit'])
	})

	it('updates dynamic spread and dynamic attr independently without cross-triggering', ()=> {
		const { App } = compileComponent(`
			const App = ({ state }) => <div {...({ title: state.title })} data-value={state.value} />
		`)
		const state = createTree({
			title: 'a',
			value: '1',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const el = container.querySelector('div')

		state.title = 'b'
		expect(el.getAttribute('title')).toBe('b')
		expect(el.getAttribute('data-value')).toBe('1')

		state.value = '2'
		expect(el.getAttribute('title')).toBe('b')
		expect(el.getAttribute('data-value')).toBe('2')
	})

	it('identifier spread from a tree Proxy stays reactive via Proxy get/ownKeys traps', ()=> {
		// `extraProps` is an Identifier → plugin emits it directly (no thunk).
		// mergeProps uses the tree Proxy object itself; its get trap provides reactivity.
		const { App } = compileComponent(`
			const App = ({ extraProps }) => <div {...extraProps} />
		`)
		const extraProps = createTree({
			'data-x': 'hello',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			extraProps,
		}))

		const el = container.querySelector('div')
		expect(el.getAttribute('data-x')).toBe('hello')

		extraProps['data-x'] = 'world'
		expect(el.getAttribute('data-x')).toBe('world')
	})

	it('identifier spread from a tree Proxy picks up a newly added key', ()=> {
		const { App } = compileComponent(`
			const App = ({ extraProps }) => <div {...extraProps} />
		`)
		const extraProps = createTree({})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			extraProps,
		}))

		const el = container.querySelector('div')
		expect(el.getAttribute('data-new')).toBe(null)

		extraProps['data-new'] = 'appeared'
		expect(el.getAttribute('data-new')).toBe('appeared')
	})

	it('child component receives spread props from tree Proxy and stays reactive', ()=> {
		const { App } = compileComponent(`
			const Child = (props) => <span>{props.label}</span>
			const App = ({ spreadProps }) => <Child {...spreadProps} />
		`)
		const spreadProps = createTree({
			label: 'before',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			spreadProps,
		}))

		expect(container.textContent).toBe('before')

		spreadProps.label = 'after'
		expect(container.textContent).toBe('after')
	})

	it('replaces all spread attrs when the spread object reference is swapped entirely', ()=> {
		const { App } = compileComponent(`
			const App = ({ state }) => <div {...state.attrs} />
		`)
		const state = createTree({
			attrs: {
				'data-a': '1',
				'data-b': '2',
			},
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const el = container.querySelector('div')
		expect(el.getAttribute('data-a')).toBe('1')
		expect(el.getAttribute('data-b')).toBe('2')

		state.attrs = {
			'data-c': '3',
		}

		expect(el.hasAttribute('data-a')).toBe(false)
		expect(el.hasAttribute('data-b')).toBe(false)
		expect(el.getAttribute('data-c')).toBe('3')
	})

	it('retains static attrs between a spread source and an explicit override across reactive cycles', ()=> {
		const { App } = compileComponent(`
			const App = ({ state }) => <div {...({ title: state.title, 'data-x': 'spread' })} data-x="pinned" />
		`)
		const state = createTree({
			title: 'v1',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			state,
		}))

		const el = container.querySelector('div')
		expect(el.getAttribute('title')).toBe('v1')
		expect(el.getAttribute('data-x')).toBe('pinned')

		state.title = 'v2'
		expect(el.getAttribute('title')).toBe('v2')
		expect(el.getAttribute('data-x')).toBe('pinned')
	})

	// The header-comment canonical pattern:
	//   <MyComp {...api()} foo={2} bar={state.b}>{kid}</MyComp>
	// api() is an external function whose return value is driven by internal
	// reactive state. The plugin wraps it as () => api() so mergeProps calls
	// it inside the binding effect, tracking any signal reads api() performs.
	it('re-applies attrs when api() returns new props after its internal reactive state changes', ()=> {
		const { App } = compileComponent(`
			const App = ({ api, state }) => <div {...api()} bar={state.bar} />
		`)
		const machine = createTree({
			id: 'orig',
			role: 'button',
		})
		const api = ()=> ({
			id: machine.id,
			role: machine.role,
		})
		const state = createTree({
			bar: 'static',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			api,
			state,
		}))

		const el = container.querySelector('div')
		expect(el.getAttribute('id')).toBe('orig')
		expect(el.getAttribute('role')).toBe('button')
		expect(el.getAttribute('bar')).toBe('static')

		machine.id = 'new-id'
		expect(el.getAttribute('id')).toBe('new-id')
		expect(el.getAttribute('role')).toBe('button')

		machine.role = 'checkbox'
		expect(el.getAttribute('role')).toBe('checkbox')
		expect(el.getAttribute('bar')).toBe('static')
	})

	it('re-applies attrs when api() adds a new key that was absent in the initial return value', ()=> {
		const { App } = compileComponent(`
			const App = ({ api }) => <div {...api()} />
		`)
		const machine = createTree({
			id: 'btn',
		})
		const api = ()=> ({
			id: machine.id,
			...(machine.pressed ? { 'aria-pressed': String(machine.pressed) } : {}),
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			api,
		}))

		const el = container.querySelector('div')
		expect(el.getAttribute('id')).toBe('btn')
		expect(el.hasAttribute('aria-pressed')).toBe(false)

		machine.pressed = true
		expect(el.getAttribute('aria-pressed')).toBe('true')

		machine.pressed = false
		expect(el.hasAttribute('aria-pressed')).toBe(false)
	})

	it('combines api() spread with sibling getter attr and children, all reactive independently', ()=> {
		const { App } = compileComponent(`
			const App = ({ api, state }) => <button {...api()} bar={state.bar}>{state.label}</button>
		`)
		const machine = createTree({
			disabled: false,
		})
		const api = ()=> ({
			disabled: machine.disabled,
			'data-machine': 'on',
		})
		const state = createTree({
			bar: 'initial',
			label: 'Click',
		})
		const container = document.createElement('div')
		document.body.appendChild(container)

		renderApp(container, h(App, {
			api,
			state,
		}))

		const el = container.querySelector('button')
		expect(el.disabled).toBe(false)
		expect(el.getAttribute('data-machine')).toBe('on')
		expect(el.getAttribute('bar')).toBe('initial')
		expect(el.textContent).toBe('Click')

		machine.disabled = true
		expect(el.disabled).toBe(true)
		expect(el.getAttribute('bar')).toBe('initial')

		state.bar = 'updated'
		expect(el.disabled).toBe(true)
		expect(el.getAttribute('bar')).toBe('updated')

		state.label = 'Done'
		expect(el.textContent).toBe('Done')
		expect(el.disabled).toBe(true)
	})
})
