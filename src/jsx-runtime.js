import {
	computed, effect, isComputed, isSignal, signal,
} from 'alien-signals'

const Fragment = Symbol('Fragment')

const isReactive = value=> isSignal(value) || isComputed(value)
const isReactiveProp = (key, value)=> {
	if (key === 'children' || key === 'style' || key === 'classList' || isClassProp(key) || isEventProp(key)){
		return false
	}

	return isReactive(value) || typeof value === 'function'
}
const createPlaceholder = ()=> document.createComment('null')
const flattenChildren = children=> children.flat(Infinity)
const isEventProp = key=> (/^on[A-Za-z]/).test(key)
const isSupportedEvent = (element, eventName)=> `on${eventName}` in element
const isBooleanDomProp = (element, key)=> key in element && typeof element[key] === 'boolean'
const isClassProp = key=> key === 'class' || key === 'className'
const readReactiveValue = source=> source()
const normalizeTextNodeValue = (value)=> {
	if (value == null || typeof value === 'boolean'){
		return ''
	}

	return String(value)
}

const createReactiveTextNode = (reactiveValue)=> {
	const textNode = document.createTextNode('')

	effect(()=> {
		textNode.data = normalizeTextNodeValue(reactiveValue())
	})

	return textNode
}

const addClassTokens = (element, value)=> {
	if (typeof value !== 'string'){
		return
	}

	const tokens = value
		.split(/\s+/)
		.filter(Boolean)

	element.classList.add(...tokens)
}

const applyStaticClasses = (element, props)=> {
	[props.class, props.className].forEach((value)=> {
		addClassTokens(element, value)
	})

	if (!props.classList || typeof props.classList !== 'object'){
		return
	}

	Object.entries(props.classList).forEach(([className, enabled])=> {
		if (enabled){
			element.classList.add(className)
		}
	})
}

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

const clearDomProp = (element, key)=> {
	if (key in element){
		try {
			element[key] = ''
		} catch {
			// Read-only DOM properties still need their attributes cleared.
		}
	}

	element.removeAttribute(key)
}

// Apply a prop value directly to the DOM. Reactive props reuse this same path inside effects.
const setDomProp = (element, key, value)=> {
	if (key === 'classList' || isClassProp(key)){
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

	if (isBooleanDomProp(element, key)){
		element[key] = Boolean(value)

		if (value){
			element.setAttribute(key, '')
			return
		}

		element.removeAttribute(key)
		return
	}

	if (value == null || value === false){
		clearDomProp(element, key)
		return
	}

	if (key in element){
		element[key] = value
		return
	}

	element.setAttribute(key, String(value))
}

const bindReactiveProp = (element, key, source)=> {
	effect(()=> {
		setDomProp(element, key, readReactiveValue(source))
	})
}

const applyStaticProps = (element, props = {})=> {
	applyStaticClasses(element, props)

	Object.entries(props).forEach(([key, value])=> {
		if (key === 'children'){
			return
		}

		if (isReactiveProp(key, value)){
			bindReactiveProp(element, key, value)
			return
		}

		setDomProp(element, key, value)
	})
	return element
}

// Normalize any JSX return value into a DOM node that can be appended safely.
const node2Element = (node)=> {
	if (node === null || node === undefined){
		console.error('null node', 1)
		return createPlaceholder()
	}
	if (isReactive(node)){
		return createReactiveTextNode(node)
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
