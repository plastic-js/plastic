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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('style: () => ({')
		expect(code).toContain('color: state.color')
		expect(code).toContain('title: () => state.title')
	})

	it('wraps dynamic component props but does not wrap event handlers or static identifiers', ()=> {
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
					importSource: 'jsx',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		// component prop with dynamic MemberExpression — should be wrapped
		expect(code).toContain('label: () => state.label')
		// intrinsic event handler — must never be wrapped
		expect(code).toContain('onClick: handlers.save')
		expect(code).not.toContain('onClick: () => handlers.save')
		// static identifier on intrinsic element — must not be wrapped
		expect(code).toContain('disabled: locked')
		expect(code).not.toContain('disabled: () => locked')
	})

	it('does not wrap intrinsic event handler expressions, so binding remains one-time', ()=> {
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
					importSource: 'jsx',
				},
			]],
			plugins: [transformReactivePlugin],
		})

		const code = transformed?.code ?? ''

		expect(code).toContain('onClick: flag() ? () => alert("A") : () => alert("B")')
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
					importSource: 'jsx',
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
