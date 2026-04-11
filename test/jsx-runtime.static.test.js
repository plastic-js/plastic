// @vitest-environment jsdom

import {
	afterEach, describe, expect, it, vi,
} from 'vitest'
import {
	appendChild,
	appendChildren,
	applyStaticProps,
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
		applyStaticProps(element, {
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

	it('merges static class, className and classList props on created elements', ()=> {
		const element = h('div', {
			class: 'btn primary',
			className: 'card',
			classList: {
				active: true,
				disabled: false,
				accent: 1,
			},
		})

		expect(element.classList.contains('btn')).toBe(true)
		expect(element.classList.contains('primary')).toBe(true)
		expect(element.classList.contains('card')).toBe(true)
		expect(element.classList.contains('active')).toBe(true)
		expect(element.classList.contains('accent')).toBe(true)
		expect(element.classList.contains('disabled')).toBe(false)
	})

	it('merges classList with static classes regardless of prop order', ()=> {
		const element = document.createElement('div')
		applyStaticProps(element, {
			classList: {
				selected: true,
			},
			className: 'panel',
			class: 'raised',
		})

		expect(element.classList.contains('selected')).toBe(true)
		expect(element.classList.contains('panel')).toBe(true)
		expect(element.classList.contains('raised')).toBe(true)
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

	it('clears boolean attributes when false is provided', ()=> {
		const input = document.createElement('input')
		input.type = 'checkbox'
		input.checked = true
		input.setAttribute('checked', '')
		input.disabled = true
		input.setAttribute('disabled', '')

		applyStaticProps(input, {
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

	it('updates className from a signal without clobbering other class sources', ()=> {
		const statusClass = signal('ready')
		const element = h('div', {
			class: 'card',
			className: statusClass,
			classList: {
				active: true,
			},
		})

		expect(element.classList.contains('card')).toBe(true)
		expect(element.classList.contains('ready')).toBe(true)
		expect(element.classList.contains('active')).toBe(true)

		statusClass('published featured')

		expect(element.classList.contains('card')).toBe(true)
		expect(element.classList.contains('active')).toBe(true)
		expect(element.classList.contains('ready')).toBe(false)
		expect(element.classList.contains('published')).toBe(true)
		expect(element.classList.contains('featured')).toBe(true)

		statusClass(null)

		expect(element.classList.contains('card')).toBe(true)
		expect(element.classList.contains('active')).toBe(true)
		expect(element.classList.contains('published')).toBe(false)
		expect(element.classList.contains('featured')).toBe(false)
	})

	it('updates class from a computed source and removes stale tokens', ()=> {
		const variant = signal('primary')
		const className = computed(()=> {
			return variant() === 'primary' ? 'btn solid' : 'btn ghost'
		})
		const element = h('button', {
			class: className,
		})

		expect(element.classList.contains('btn')).toBe(true)
		expect(element.classList.contains('solid')).toBe(true)
		expect(element.classList.contains('ghost')).toBe(false)

		variant('secondary')

		expect(element.classList.contains('btn')).toBe(true)
		expect(element.classList.contains('solid')).toBe(false)
		expect(element.classList.contains('ghost')).toBe(true)
	})

	it('updates classList entries when reactive entry values change', ()=> {
		const isActive = signal(true)
		const isHidden = signal(false)
		const element = h('div', {
			className: 'panel',
			classList: {
				active: isActive,
				hidden: ()=> isHidden(),
			},
		})

		expect(element.classList.contains('panel')).toBe(true)
		expect(element.classList.contains('active')).toBe(true)
		expect(element.classList.contains('hidden')).toBe(false)

		isActive(false)
		isHidden(true)

		expect(element.classList.contains('panel')).toBe(true)
		expect(element.classList.contains('active')).toBe(false)
		expect(element.classList.contains('hidden')).toBe(true)
	})

	it('renders reactive nullish and boolean values as empty text', ()=> {
		const value = signal('ready')
		const element = h('p', null, value)

		expect(element.textContent).toBe('ready')

		value(null)
		expect(element.textContent).toBe('')

		value(false)
		expect(element.textContent).toBe('')

		value(0)
		expect(element.textContent).toBe('0')
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

	it('rejects custom component tags', ()=> {
		const CustomTag = ()=> document.createElement('div')

		expect(()=> h(CustomTag, null)).toThrow('Only static string tags and Fragment are supported.')
	})
})
