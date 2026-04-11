import {
	computed, effect, isComputed, isSignal, signal,
} from 'alien-signals'

const Fragment = Symbol('Fragment')

const isReactive = value=> isSignal(value) || isComputed(value)
const createPlaceholder = ()=> document.createComment('null')
const flattenChildren = children=> children.flat(Infinity)
const isEventProp = key=> (/^on[A-Za-z]/).test(key)
const isSupportedEvent = (element, eventName)=> `on${eventName}` in element
const isBooleanDomProp = (element, key)=> key in element && typeof element[key] === 'boolean'
// jsx 語法層面，已經 disallow 'class'
const isClassProp = key=> key === 'className' || key === 'classList'
const classNameCache = new WeakMap()
const normalizeTextNodeValue = (value)=> {
	if (value == null){
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

const toClassTokens = (value)=> {
	if (typeof value !== 'string'){
		return new Set()
	}

	return new Set(value
		.split(/\s+/)
		.filter(Boolean))
}

const toClassListMap = (value)=> {
	// null
	if(!value){
		return new Map()
	}
	// string
	const tokens = toClassTokens(value)
	const map = new Map()
	tokens.forEach((token)=> {
		map.set(token, true)
	})
	return map
}

const applyClassNameMap = (element, classNameMap)=> {
	if (!(classNameMap instanceof Map)){
		const temp = new Map()
		Object.entries(classNameMap).forEach(([className, enabled])=> {
			temp.set(className, enabled)
		})
		classNameMap = temp
	}
	classNameMap.forEach((enabled, className)=> {
		// if should be enabled but isn't, add it
		if (enabled && !element.classList.contains(className)){
			element.classList.add(className)
		}

		// if shouldn't be enabled but is, remove it
		if (!enabled && element.classList.contains(className)){
			element.classList.remove(className)
		}
	})
}

const applyClass = (element, key, value)=> {
	if (key === 'classList'){
		return applyClassListProp(element, value)
	}
	applyClassProp(element, value)
}

const getCachedClassSet = (element)=> {
	let cached = classNameCache.get(element)
	if (!cached){
		cached = new Set()
		classNameCache.set(element, cached)
	}
	return cached
}

const applyClassProp = (element, value)=> {
	if (isReactive(value) || typeof value === 'function'){
		effect(()=> {
			const expectedClass = toClassListMap(value())
			const actualClass = getCachedClassSet(element)
			const shouldRemove = [...actualClass].filter(className=> !expectedClass.has(className))
			const combinedClassMap = new Map([...expectedClass, ...shouldRemove.map(className=> [className, false])])
			applyClassNameMap(element, combinedClassMap)
			classNameCache.set(element, new Set(expectedClass.keys()))
		})
		return
	}

	applyClassNameMap(element, toClassListMap(value))
	classNameCache.set(element, toClassTokens(value))
}

const hasReactiveClassListEntries = value=> value && typeof value === 'object' && Object.values(value).some(entry=> isReactive(entry) || typeof entry === 'function')

const applyClassListProp = (element, value)=> {
	const resolveClassListEntry = (value)=> {
		if (isReactive(value) || typeof value === 'function'){
			return value()
		}

		return value
	}
	// think of all the situations as reactive
	effect(()=> {
		// default to static value 
		let obj = value
		if (isReactive(value) || typeof value === 'function'){
			obj = value()
		}
		if (hasReactiveClassListEntries(value)){
			// iterate through the object and resolve any reactive entries before applying the class list map
			obj = Object.entries(value).reduce((acc, [className, enabled])=> {
				acc[className] = resolveClassListEntry(enabled)
				return acc
			}, {})
		}
		applyClassNameMap(element, obj)
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

const applyCommonAttribute = (element, key, source)=> {
	if (isReactive(source) || typeof source === 'function'){
		effect(()=> {
			setDomProp(element, key, source())
		})
		return
	}
	setDomProp(element, key, source)
}

const applyProps = (element, props = {})=> {
	const entries = Object.entries(props)
	entries.sort(([keyA], [keyB])=> {
		if (keyA === 'classList'){
			return 1
		}
		if (keyB === 'classList'){
			return -1
		}
		return 0
	})
	entries.forEach(([key, value])=> {
		if (key === 'children'){
			return
		}

		if (isClassProp(key)){
			applyClass(element, key, value)
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

		applyCommonAttribute(element, key, value)
	})
	return element
}

// Normalize any JSX return value into a DOM node that can be appended safely.
const node2Element = (node)=> {
	if (node === null || node === undefined){
		console.error('null node', 1)
		return createPlaceholder()
	}
	// reactive，但是不一定是text，目前假定他是text，for simplicity
	if (isReactive(node)){
		return createReactiveTextNode(node)
	}
	if (typeof node === 'string' || typeof node === 'number'){
		return document.createTextNode(String(node))
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
	applyProps(element, nextProps)
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
	applyProps,
}
