import {
	computed, effect, isComputed, isSignal, signal,
} from 'alien-signals'

const Fragment = Symbol('Fragment')

const isReactive = value=> isSignal(value) || isComputed(value)
const createPlaceholder = ()=> document.createComment('null')
const flattenChildren = children=> children.flat(Infinity)
const isEventProp = key=> (/^on[A-Za-z]/).test(key)
const isSupportedEvent = (element, eventName)=> `on${eventName}` in element

const applyStyleObject = (element, styles)=> {
	Object.entries(styles).forEach(([property, value])=> {
		if (value == null || value === false){
			return
		}

		if (property.startsWith('--')){
			element.style.setProperty(property, String(value))
			return
		}

		element.style[property] = value
	})
}

// Apply props that can be resolved immediately without subscribing to reactive values.
const setStaticProp = (element, key, value)=> {
	if (value == null || value === false){
		return
	}

	if (isEventProp(key)){
		if (typeof value === 'function'){
			const eventName = key.slice(2).toLowerCase()
			if (isSupportedEvent(element, eventName)){
				element.addEventListener(eventName, value)
			}
		}
		return
	}

	if (key === 'style' && value && typeof value === 'object'){
		applyStyleObject(element, value)
		return
	}

	if (key in element){
		element[key] = value
		return
	}

	element.setAttribute(key, String(value))
}

const applyStaticProps = (element, props = {})=> {
	// Reactive props are skipped here because they need a separate update strategy.
	Object.entries(props).forEach(([key, value])=> {
		if (key === 'children' || isReactive(value)){
			return
		}
		setStaticProp(element, key, value)
	})
	return element
}

// Normalize any JSX return value into a DOM node that can be appended safely.
const node2Element = (node)=> {
	if (node === null || node === undefined){
		console.error('null node', 1)
		return createPlaceholder()
	}
	if (typeof node === 'string' || typeof node === 'number'){
		return document.createTextNode(String(node))
	}
	if (typeof node === 'boolean'){
		return createPlaceholder()
	}
	if (node instanceof HTMLElement || node instanceof Text || node instanceof Comment || node instanceof DocumentFragment){
		return node
	}
	if (Array.isArray(node)){
		const fragment = document.createDocumentFragment()
		appendChildren(fragment, node)
		return fragment
	}
	return createPlaceholder()
}

// Ignore empty JSX children and append everything else after normalization.
const appendChild = (parent, child)=> {
	if (child == null){
		return parent
	}

	parent.appendChild(node2Element(child))
	return parent
}

const appendChildren = (parent, children)=> {
	// Flatten first so nested array children from conditionals or loops work naturally.
	flattenChildren(children).forEach((child)=> {
		appendChild(parent, child)
	})
	return parent
}

const h = (tag, props, ...children)=> {
	const nextProps = props || {}
	const propChildren = nextProps.children ?? []
	const mergedChildren = [...[propChildren], ...children]

	if (tag === Fragment){
		// Fragments produce a DocumentFragment so no wrapper element is introduced.
		const fragment = document.createDocumentFragment()
		appendChildren(fragment, mergedChildren)
		return fragment
	}

	if (typeof tag !== 'string'){
		throw new Error('Only static string tags and Fragment are supported.')
	}

	// Native tags create real DOM elements directly without a virtual DOM layer.
	const element = document.createElement(tag)
	applyStaticProps(element, nextProps)
	appendChildren(element, mergedChildren)
	return element
}

const jsx = (tag, props)=> h(tag, props)
const jsxs = (tag, props)=> h(tag, props)
const onMount = ()=> {}
const onUnmount = ()=> {}

// Render by appending the normalized root node into the target container.
const renderApp = (container, node)=> {
	container.appendChild(node2Element(node))
	return container
}

export {
	Fragment,
	h,
	jsx,
	jsxs,
	onMount,
	onUnmount,
	renderApp,
	signal, computed, effect,
	// expose some internal utils for testing and advanced use cases, but these are not considered part of the public API and may change without a major version bump.
	appendChild,
	appendChildren,
	applyStaticProps,
}
