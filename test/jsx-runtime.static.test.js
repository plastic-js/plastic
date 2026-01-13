// @vitest-environment jsdom

import {
	afterEach, describe, expect, it,
} from 'vitest'
import {
	appendChild,
	appendChildren,
	applyStaticProps,
	h,
	jsx,
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
		})

		expect(element.getAttribute('for')).toBe('field-id')
		expect(element.className).toBe('field-label')
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

	it('routes jsx automatic runtime calls through h', ()=> {
		const element = jsx('section', {
			className: 'panel',
			children: 'content',
		})

		expect(element.tagName).toBe('SECTION')
		expect(element.className).toBe('panel')
		expect(element.textContent).toBe('content')
	})

	it('rejects custom component tags', ()=> {
		const CustomTag = ()=> document.createElement('div')

		expect(()=> h(CustomTag, null)).toThrow('Only static string tags and Fragment are supported.')
	})
})
