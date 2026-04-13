// @vitest-environment jsdom

import {
	afterEach, describe, expect, it, vi,
} from 'vitest'
import {
	appendChild,
	appendChildren,
	applyProps,
	computed,
	h,
	jsx,
	signal,
} from '../src/jsx-runtime.js'

describe('jsx runtime static rendering', ()=> {
	afterEach(()=> {
		document.body.innerHTML = ''
	})

	it('creates a static element with attributes', ()=> {
		const element = h('div', {
			id: 'root',
			className: 'card',
			title: 'static-title',
		})

		expect(element.tagName).toBe('DIV')
		expect(element.id).toBe('root')
		expect(element.className).toBe('card')
		expect(element.getAttribute('title')).toBe('static-title')
	})

	it('applies static props onto an existing element', ()=> {
		const element = document.createElement('label')
		applyProps(element, {
			htmlFor: 'field-id',
			className: 'field-label',
			style: {
				backgroundColor: 'black',
				paddingInline: '12px',
				'--accent-color': '#f40',
			},
		})

		expect(element.getAttribute('for')).toBe('field-id')
		expect(element.className).toBe('field-label')
		expect(element.style.backgroundColor).toBe('black')
		expect(element.style.paddingInline).toBe('12px')
		expect(element.style.getPropertyValue('--accent-color')).toBe('#f40')
	})

	it('supports boolean attributes on created elements', ()=> {
		const button = h('button', {
			disabled: true,
		}, 'Tap')
		const input = h('input', {
			type: 'checkbox',
			checked: true,
		})

		expect(button.disabled).toBe(true)
		expect(button.getAttribute('disabled')).toBe('')
		expect(input.checked).toBe(true)
		expect(input.getAttribute('checked')).toBe('')
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

	it('ignores non-function event prop values', ()=> {
		const button = h('button', {
			onClick: 'invalid',
		}, 'Tap')

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

	it('appends string, number and nested DOM children', ()=> {
		const strong = document.createElement('strong')
		strong.textContent = 'world'

		const element = h('p', null, 'hello', 42, [strong])
		document.body.appendChild(element)

		expect(element.childNodes).toHaveLength(3)
		expect(element.childNodes[0].textContent).toBe('hello')
		expect(element.childNodes[1].textContent).toBe('42')
		expect(element.childNodes[2]).toBe(strong)
	})

	it('supports appendChild and appendChildren helpers', ()=> {
		const element = document.createElement('div')
		const span = document.createElement('span')
		span.textContent = 'tail'

		appendChild(element, 'head')
		appendChildren(element, [1, [span]])

		expect(element.childNodes).toHaveLength(3)
		expect(element.textContent).toBe('head1tail')
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

	it('updates text nodes when a computed child changes', ()=> {
		const firstName = signal('Ada')
		const label = computed(()=> `Hello ${firstName()}`)
		const element = h('p', null, label)

		expect(element.textContent).toBe('Hello Ada')

		firstName('Lin')

		expect(element.textContent).toBe('Hello Lin')
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

	it('updates DOM props when a computed prop changes', ()=> {
		const fieldId = signal('email')
		const htmlFor = computed(()=> `field-${fieldId()}`)
		const element = h('label', {
			htmlFor,
		}, 'Email')

		expect(element.htmlFor).toBe('field-email')
		expect(element.getAttribute('for')).toBe('field-email')

		fieldId('name')

		expect(element.htmlFor).toBe('field-name')
		expect(element.getAttribute('for')).toBe('field-name')
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

	it('updates dynamic boolean props from a computed source', ()=> {
		const ready = signal(false)
		const enabled = computed(()=> ready())
		const editable = computed(()=> ready())

		const button = h('button', {
			disabled: computed(()=> !enabled()),
		}, 'Submit')
		const textInput = h('input', {
			type: 'text',
			readOnly: computed(()=> !editable()),
		})

		expect(button.disabled).toBe(true)
		expect(button.hasAttribute('disabled')).toBe(true)
		expect(textInput.readOnly).toBe(true)
		expect(textInput.hasAttribute('readonly')).toBe(true)

		ready(true)

		expect(button.disabled).toBe(false)
		expect(button.hasAttribute('disabled')).toBe(false)
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

	it('updates className from a computed source and removes stale tokens', ()=> {
		const variant = signal('primary')
		const className = computed(()=> {
			return variant() === 'primary' ? 'btn solid' : 'btn ghost'
		})
		const element = h('button', {
			className,
		})

		expect(element.classList.contains('btn')).toBe(true)
		expect(element.classList.contains('solid')).toBe(true)
		expect(element.classList.contains('ghost')).toBe(false)

		variant('secondary')

		expect(element.classList.contains('btn')).toBe(true)
		expect(element.classList.contains('solid')).toBe(false)
		expect(element.classList.contains('ghost')).toBe(true)
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

	it('applies a static style string via cssText', ()=> {
		const element = h('div', {
			style: 'color: red; font-size: 14px',
		})

		expect(element.style.color).toBe('red')
		expect(element.style.fontSize).toBe('14px')
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

	it('updates style from a computed source and diffs keys correctly', ()=> {
		const active = signal(false)
		const styles = computed(()=> active()
			? {
				fontWeight: 'bold',
				color: 'green',
			}
			: {
				fontWeight: 'normal',
			})
		const element = h('div', {
			style: styles,
		})

		expect(element.style.fontWeight).toBe('normal')
		expect(element.style.color).toBe('')

		active(true)

		expect(element.style.fontWeight).toBe('bold')
		expect(element.style.color).toBe('green')

		active(false)

		expect(element.style.fontWeight).toBe('normal')
		expect(element.style.color).toBe('')
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

	it('maps autoFocus to the autofocus DOM property', ()=> {
		const input = h('input', {
			autoFocus: true,
		})

		expect(input.autofocus).toBe(true)
		expect(input.getAttribute('autofocus')).toBe('')
	})

	it('maps autoComplete to the autocomplete DOM property on input', ()=> {
		const input = h('input', {
			autoComplete: 'email',
		})

		expect(input.autocomplete).toBe('email')
	})

	it('maps autoPlay to the autoplay DOM property on video', ()=> {
		const video = h('video', {
			autoPlay: true,
		})

		expect(video.autoplay).toBe(true)
		expect(video.getAttribute('autoplay')).toBe('')
	})

	it('maps encType to the enctype DOM property on form', ()=> {
		const form = h('form', {
			encType: 'multipart/form-data',
		})

		expect(form.enctype).toBe('multipart/form-data')
	})

	it('maps hrefLang to the hreflang DOM property on anchor', ()=> {
		const a = h('a', {
			hrefLang: 'zh-TW',
		})

		expect(a.hreflang).toBe('zh-TW')
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

	it('renders a function component by calling it with props', ()=> {
		const Greeting = ({ name })=> h('span', null, `Hello, ${name}!`)
		const element = h(Greeting, { name: 'World' })

		expect(element.tagName).toBe('SPAN')
		expect(element.textContent).toBe('Hello, World!')
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
