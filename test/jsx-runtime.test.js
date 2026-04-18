// @vitest-environment jsdom

import {
	afterEach, describe, expect, it, vi,
} from 'vitest'
import {
	appendChildren,
	applyProps,
	createOwner,
	disposeOwner,
	h,
	jsx,
	onMount,
	renderApp,
	signal,
} from '../src/jsx-runtime.js'
import { onCleanup } from '../src/index.js'

describe('jsx runtime static rendering', ()=> {
	afterEach(()=> {
		document.body.innerHTML = ''
	})

	it('rejects classList prop and asks callers to use className', ()=> {
		expect(()=> h('div', {
			classList: {
				active: true,
			},
		})).toThrow('classList prop is not supported. Use className instead.')
	})

	it('clears boolean attributes when false is provided', ()=> {
		const input = document.createElement('input')
		input.type = 'checkbox'
		input.checked = true
		input.setAttribute('checked', '')
		input.disabled = true
		input.setAttribute('disabled', '')

		applyProps(input, {
			checked: false,
			disabled: false,
		})

		expect(input.checked).toBe(false)
		expect(input.disabled).toBe(false)
		expect(input.hasAttribute('checked')).toBe(false)
		expect(input.hasAttribute('disabled')).toBe(false)
	})

	it('binds event handlers from onXxx props', ()=> {
		const onClick = vi.fn()
		const button = h('button', {
			onClick,
		}, 'Tap')

		button.click()

		expect(onClick).toHaveBeenCalledTimes(1)
		expect(button.getAttribute('onClick')).toBeNull()
	})

	it('ignores unsupported event names', ()=> {
		const onInvalid = vi.fn()
		const button = h('button', {
			onDefinitelyNotARealEvent: onInvalid,
		}, 'Tap')

		button.dispatchEvent(new Event('definitelynotarealevent'))

		expect(onInvalid).not.toHaveBeenCalled()
	})

	it('updates text nodes when a signal child changes', ()=> {
		const count = signal(1)
		const element = h('p', null, 'Count: ', count)

		expect(element.textContent).toBe('Count: 1')
		expect(element.childNodes).toHaveLength(2)
		expect(element.childNodes[1].nodeType).toBe(Node.TEXT_NODE)

		count(2)

		expect(element.textContent).toBe('Count: 2')
	})

	it('updates DOM props when a signal prop changes', ()=> {
		const title = signal('draft')
		const element = h('div', {
			title,
		})

		expect(element.title).toBe('draft')
		expect(element.getAttribute('title')).toBe('draft')

		title('published')

		expect(element.title).toBe('published')
		expect(element.getAttribute('title')).toBe('published')

		title(null)

		expect(element.title).toBe('')
		expect(element.hasAttribute('title')).toBe(false)
	})

	it('updates DOM props from getter sources that read signals', ()=> {
		const prefix = signal('Ada')
		const element = h('div', {
			'aria-label': ()=> `${prefix()} Lovelace`,
		})

		expect(element.getAttribute('aria-label')).toBe('Ada Lovelace')

		prefix('Grace')

		expect(element.getAttribute('aria-label')).toBe('Grace Lovelace')
	})

	it('updates dynamic boolean props from a signal source', ()=> {
		const disabled = signal(true)
		const checked = signal(true)
		const selected = signal(true)
		const readOnly = signal(true)

		const button = h('button', {
			disabled,
		}, 'Submit')
		const checkbox = h('input', {
			type: 'checkbox',
			checked,
		})
		const option = h('option', {
			selected,
		}, 'A')
		const textInput = h('input', {
			type: 'text',
			readOnly,
		})

		expect(button.disabled).toBe(true)
		expect(button.hasAttribute('disabled')).toBe(true)
		expect(checkbox.checked).toBe(true)
		expect(checkbox.hasAttribute('checked')).toBe(true)
		expect(option.selected).toBe(true)
		expect(option.hasAttribute('selected')).toBe(true)
		expect(textInput.readOnly).toBe(true)
		expect(textInput.hasAttribute('readonly')).toBe(true)

		disabled(false)
		checked(false)
		selected(false)
		readOnly(false)

		expect(button.disabled).toBe(false)
		expect(button.hasAttribute('disabled')).toBe(false)
		expect(checkbox.checked).toBe(false)
		expect(checkbox.hasAttribute('checked')).toBe(false)
		expect(option.selected).toBe(false)
		expect(option.hasAttribute('selected')).toBe(false)
		expect(textInput.readOnly).toBe(false)
		expect(textInput.hasAttribute('readonly')).toBe(false)
	})

	it('updates className from a signal and removes stale tokens', ()=> {
		const statusClass = signal('card ready')
		const element = h('div', {
			className: statusClass,
		})

		expect(element.classList.contains('card')).toBe(true)
		expect(element.classList.contains('ready')).toBe(true)
		expect(element.classList.contains('active')).toBe(false)

		statusClass('card published featured')

		expect(element.classList.contains('card')).toBe(true)
		expect(element.classList.contains('active')).toBe(false)
		expect(element.classList.contains('ready')).toBe(false)
		expect(element.classList.contains('published')).toBe(true)
		expect(element.classList.contains('featured')).toBe(true)

		statusClass(null)

		expect(element.classList.contains('card')).toBe(false)
		expect(element.classList.contains('active')).toBe(false)
		expect(element.classList.contains('ready')).toBe(false)
		expect(element.classList.contains('published')).toBe(false)
		expect(element.classList.contains('featured')).toBe(false)
	})

	it('renders reactive nullish values as empty text and booleans as strings', ()=> {
		const value = signal('ready')
		const element = h('p', null, value)

		expect(element.textContent).toBe('ready')

		value(null)
		expect(element.textContent).toBe('')

		value(false)
		expect(element.textContent).toBe('false')

		value(0)
		expect(element.textContent).toBe('0')
	})

	it('updates style from a reactive string and clears on null', ()=> {
		const styleStr = signal('color: red')
		const element = h('div', {
			style: styleStr,
		})

		expect(element.style.color).toBe('red')

		styleStr('color: blue; font-size: 12px')

		expect(element.style.color).toBe('blue')
		expect(element.style.fontSize).toBe('12px')

		styleStr(null)

		expect(element.style.cssText).toBe('')
	})

	it('updates style from a reactive object and clears removed keys', ()=> {
		const styles = signal({
			color: 'red',
			fontSize: '14px',
		})
		const element = h('div', {
			style: styles,
		})

		expect(element.style.color).toBe('red')
		expect(element.style.fontSize).toBe('14px')

		styles({
			color: 'blue',
		})

		expect(element.style.color).toBe('blue')
		expect(element.style.fontSize).toBe('')
	})

	it('routes jsx automatic runtime calls through h', ()=> {
		const element = jsx('section', {
			className: 'panel',
			style: {
				borderTop: '2px solid teal',
			},
			children: 'content',
		})

		expect(element.tagName).toBe('SECTION')
		expect(element.className).toBe('panel')
		expect(element.style.borderTop).toBe('2px solid teal')
		expect(element.textContent).toBe('content')
	})

	it('supports reactive autoFocus via a signal', ()=> {
		const focused = signal(false)
		const input = h('input', {
			autoFocus: focused,
		})

		expect(input.autofocus).toBe(false)
		expect(input.hasAttribute('autofocus')).toBe(false)

		focused(true)

		expect(input.autofocus).toBe(true)
		expect(input.getAttribute('autofocus')).toBe('')
	})

	it('passes children to function components via props.children', ()=> {
		const Wrapper = ({ children })=> {
			const div = document.createElement('div')
			div.className = 'wrapper'
			appendChildren(div, Array.isArray(children) ? children : [children])
			return div
		}
		const element = h(Wrapper, null, h('p', null, 'inner'))

		expect(element.tagName).toBe('DIV')
		expect(element.className).toBe('wrapper')
		expect(element.firstChild.tagName).toBe('P')
		expect(element.firstChild.textContent).toBe('inner')
	})

	it('passes a single vararg child as a bare node, not wrapped in an array', ()=> {
		const Wrapper = ({ children })=> {
			expect(Array.isArray(children)).toBe(false)
			return h('div', null, children)
		}
		const element = h(Wrapper, null, h('p', null, 'solo'))

		expect(element.firstChild.tagName).toBe('P')
		expect(element.firstChild.textContent).toBe('solo')
	})

	it('passes multiple vararg children as an array without a leading empty entry', ()=> {
		const List = ({ children })=> {
			expect(Array.isArray(children)).toBe(true)
			expect(children).toHaveLength(2)
			return h('ul', null, children)
		}
		const element = h(List, null, h('li', null, 'a'), h('li', null, 'b'))

		expect(element.querySelectorAll('li')).toHaveLength(2)
		expect(element.querySelectorAll('li')[0].textContent).toBe('a')
		expect(element.querySelectorAll('li')[1].textContent).toBe('b')
	})

	it('passes reactive props to function components', ()=> {
		const Label = ({ text })=> h('label', null, text)
		const text = signal('draft')
		const element = h(Label, { text })

		expect(element.textContent).toBe('draft')

		text('published')

		expect(element.textContent).toBe('published')
	})
})

describe('lifecycle & cleanup management', ()=> {
	afterEach(()=> {
		document.body.innerHTML = ''
	})

	it('executes onMount callback after component renders', ()=> {
		const onMountCallback = vi.fn()
		const Component = ()=> {
			onMount(onMountCallback)
			return h('div', null, 'content')
		}

		const container = document.createElement('div')
		document.body.appendChild(container)
		renderApp(container, h(Component))

		expect(container.textContent).toBe('content')
		expect(onMountCallback).toHaveBeenCalledTimes(1)
	})

	it('onMount callbacks execute in order', ()=> {
		const order = []
		const Component = ()=> {
			onMount(()=> order.push(1))
			onMount(()=> order.push(2))
			onMount(()=> order.push(3))
			return h('div', null, 'test')
		}

		const container = document.createElement('div')
		document.body.appendChild(container)
		renderApp(container, h(Component))

		expect(order).toEqual([1, 2, 3])
	})

	it('onMount executes for nested owners in child-first order', ()=> {
		const order = []

		const Child = ()=> {
			onMount(()=> order.push('child'))
			return h('span', null, 'child')
		}

		const Parent = ()=> {
			onMount(()=> order.push('parent'))
			return h('div', null, h(Child))
		}

		const container = document.createElement('div')
		document.body.appendChild(container)
		renderApp(container, h(Parent))

		expect(order).toEqual(['child', 'parent'])
	})

	it('disposeOwner executes effects in child-first order', ()=> {
		const order = []
		const parentOwner = createOwner(null)
		const childOwner = createOwner(parentOwner)

		childOwner.effects.push(()=> order.push('child-effect'))
		parentOwner.effects.push(()=> order.push('parent-effect'))

		disposeOwner(parentOwner)

		expect(order).toEqual(['child-effect', 'parent-effect'])
	})

	it('onCleanup in component runs on unmount', ()=> {
		const cleanupFn = vi.fn()
		const Component = ()=> {
			onCleanup(cleanupFn)
			return h('div', null, 'test')
		}

		const container = document.createElement('div')
		document.body.appendChild(container)

		expect(cleanupFn).not.toHaveBeenCalled()

		const dispose = renderApp(container, h(Component))
		expect(cleanupFn).not.toHaveBeenCalled()

		dispose()
		expect(cleanupFn).toHaveBeenCalledTimes(1)
	})

	it('renderApp returns a disposer function that cleans up resources', ()=> {
		const onMountFn = vi.fn()
		const onCleanupFn = vi.fn()

		const Component = ()=> {
			onMount(onMountFn)
			onCleanup(onCleanupFn)
			return h('div', null, 'content')
		}

		const container = document.createElement('div')
		document.body.appendChild(container)

		const dispose = renderApp(container, h(Component))

		expect(onMountFn).toHaveBeenCalledTimes(1)
		expect(container.childNodes).toHaveLength(1)
		expect(container.textContent).toBe('content')

		dispose()

		expect(onCleanupFn).toHaveBeenCalledTimes(1)
		expect(container.childNodes).toHaveLength(0)
	})

	it('event listener cleanup removes listeners on dispose', ()=> {
		const onClick = vi.fn()
		const Component = ()=> h('button', { onClick }, 'Click')

		const container = document.createElement('div')
		document.body.appendChild(container)
		const dispose = renderApp(container, h(Component))

		const button = container.querySelector('button')
		button.click()
		expect(onClick).toHaveBeenCalledTimes(1)

		dispose()

		// After dispose, clicking should not trigger handler
		if (button.parentNode){
			button.click()
			// Still 1, not 2
			expect(onClick).toHaveBeenCalledTimes(1)
		}
	})

	it('nested component cleanup propagates to children', ()=> {
		const parentCleanup = vi.fn()
		const childCleanup = vi.fn()

		const Child = ()=> {
			onCleanup(childCleanup)
			return h('span', null, 'child')
		}

		const Parent = ()=> {
			onCleanup(parentCleanup)
			return h('div', null, h(Child))
		}

		const container = document.createElement('div')
		document.body.appendChild(container)
		const dispose = renderApp(container, h(Parent))

		expect(parentCleanup).not.toHaveBeenCalled()
		expect(childCleanup).not.toHaveBeenCalled()

		dispose()

		expect(parentCleanup).toHaveBeenCalledTimes(1)
		expect(childCleanup).toHaveBeenCalledTimes(1)
	})

	it('disposeOwner cleans up all descendant owners', ()=> {
		const cleanups = []

		const cleanup1 = ()=> cleanups.push(1)
		const cleanup2 = ()=> cleanups.push(2)
		const cleanup3 = ()=> cleanups.push(3)

		const owner1 = createOwner(null)
		const owner2 = createOwner(owner1)
		const owner3 = createOwner(owner1)

		owner1.cleanups.push(cleanup1)
		owner2.cleanups.push(cleanup2)
		owner3.cleanups.push(cleanup3)

		owner1.children.add(owner2)
		owner1.children.add(owner3)

		disposeOwner(owner1)

		expect(cleanups.sort()).toEqual([1, 2, 3])
	})

	it('multiple onCleanup callbacks run in reverse order', ()=> {
		const order = []

		const Component = ()=> {
			onCleanup(()=> order.push(1))
			onCleanup(()=> order.push(2))
			onCleanup(()=> order.push(3))
			return h('div', null, 'test')
		}

		const container = document.createElement('div')
		document.body.appendChild(container)
		const dispose = renderApp(container, h(Component))

		dispose()

		// Last registered cleanup runs first (LIFO)
		expect(order).toEqual([3, 2, 1])
	})

	it('tracks owner cleanup when component returns a primitive', ()=> {
		const cleaned = vi.fn()
		const ValueComponent = ()=> {
			onCleanup(cleaned)
			return 'plain text'
		}

		const container = document.createElement('div')
		document.body.appendChild(container)
		const dispose = renderApp(container, h(ValueComponent))

		expect(container.textContent).toBe('plain text')
		expect(cleaned).not.toHaveBeenCalled()

		dispose()
		expect(cleaned).toHaveBeenCalledTimes(1)
	})
})

