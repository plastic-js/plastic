import {
	createComputed, createSignal, createTree, effect, isComputed, isSignal, isTree, toRaw,
} from './reactivity.js'
import {
	flattenChildren, isEventProp, normalizeTextNodeValue, toClassMap, toClassTokens,
} from './utils.js'
import { getCurrentComputation, setCurrentComputation } from './computation-context.js'
import { createControlFlow } from './control-flow.js'

const Fragment = Symbol('Fragment')
const OWNER = Symbol('owner')

// ============ Owner & Lifecycle Management ============
// Global context for effect scoping and cleanup tracking
let currentOwner = null

const CONTEXT_ID = Symbol('context-id')

const getCurrentOwner = ()=> currentOwner

const createOwner = (parent = null)=> {
	const owner = {
		parent,
		children: new Set(),
		cleanups: [],
		effects: [],
		contexts: new Map(),
		refs: [],
		mounts: [],
		mounted: false,
	}
	if (parent){
		parent.children.add(owner)
	}
	return owner
}

const runOwnerMounts = (owner)=> {
	owner.children.forEach(child=> runOwnerMounts(child))
	owner.refs.forEach((fn)=> {
		fn()
	})
	owner.mounts.forEach((fn)=> {
		fn()
	})
	owner.mounted = true
}

const runWithOwner = (owner, fn)=> {
	const prev = currentOwner
	currentOwner = owner
	try {
		return fn()
	} finally {
		currentOwner = prev
	}
}

const renderInOwner = (owner, result)=> runWithOwner(owner, ()=> node2Element(result))

const disposeOwner = (owner)=> {
	if (owner.parent){
		owner.parent.children.delete(owner)
	}

	// Dispose all child owners recursively
	owner.children.forEach(child=> disposeOwner(child))
	owner.children.clear()

	// Stop owner-bound effects for this scope during unmount.
	;[...owner.effects].reverse().forEach((stop)=> {
		if (typeof stop === 'function'){
			stop()
		}
	})
	owner.effects.length = 0

	;[...owner.cleanups].reverse().forEach((cleanup)=> {
		if (typeof cleanup === 'function'){
			cleanup()
		}
	})
	owner.cleanups.length = 0
	owner.refs.length = 0
	owner.mounts.length = 0
}

// Create a binding effect that integrates with the owner system
const createBindingEffect = (runner)=> {
	const owner = currentOwner
	// effect-level cleanups (run before each re-execution)
	const local = []

	const stop = effect(()=> {
		// Run effect-level cleanups in reverse order
		[...local].reverse().forEach((l)=> {
			l()
		})
		local.length = 0

		// Set up computation context for onCleanup within the effect
		const prevComp = getCurrentComputation()
		setCurrentComputation({ cleanups: local })
		try {
			runner()
		} finally {
			setCurrentComputation(prevComp)
		}
	})

	if (!owner){
		return stop
	}
	// Register effect and its disposal in the owner
	owner.effects.push(stop)
	owner.cleanups.push(()=> {
		// Run remaining local cleanups
		[...local].reverse().forEach((l)=> {
			l()
		})

		local.length = 0
	})

	return stop
}

const registerCleanup = (fn)=> {
	const currentComputation = getCurrentComputation()
	if (!currentOwner && !currentComputation){
		throw new Error('registerCleanup must be called within a component or effect scope')
	}
	if (currentComputation){
		currentComputation.cleanups.push(fn)
	} else {
		currentOwner.cleanups.push(fn)
	}
}

// Public API: onMount - register function to run after mount
const onMount = (fn)=> {
	if (!currentOwner){
		throw new Error('onMount must be called within a component scope')
	}
	currentOwner.mounts.push(fn)
}

const onUnmount = (fn)=> {
	if (!currentOwner){
		throw new Error('onUnmount must be called within a component scope')
	}
	currentOwner.cleanups.push(fn)
}

const createContext = (defaultValue)=> {
	const context = {
		[CONTEXT_ID]: Symbol('context'),
		defaultValue,
	}

	// eslint-disable-next-line react/display-name
	context.Provider = ({ value, children })=> {
		if (!currentOwner){
			throw new Error('Context Provider must be rendered within a component scope')
		}

		currentOwner.contexts.set(context[CONTEXT_ID], value)

		if (typeof children === 'function'){
			return children()
		}

		return children ?? null
	}

	return context
}

const useContext = (context)=> {
	if (!context || typeof context !== 'object' || !(CONTEXT_ID in context)){
		throw new Error('useContext requires a context created by createContext')
	}

	if (!currentOwner){
		throw new Error('useContext must be called within a component scope')
	}

	let owner = currentOwner
	while (owner){
		if (owner.contexts.has(context[CONTEXT_ID])){
			return owner.contexts.get(context[CONTEXT_ID])
		}
		owner = owner.parent
	}

	return context.defaultValue
}

const isReactivePrimitive = value=> value != null && (isSignal(value) || isComputed(value))
const isReactive = value=> isReactivePrimitive(value) || typeof value === 'function'
const createPlaceholder = ()=> document.createComment('null')
const isSupportedEvent = (element, eventName)=> `on${eventName}` in element
const isBooleanDomProp = (element, key)=> key in element && typeof element[key] === 'boolean'

// JSX uses camelCase for some props whose corresponding DOM property is all-lowercase.
// Normalise the key before any DOM access so the property lookup and setAttribute
// calls use the name the browser actually exposes.
const JSX_PROP_MAP = {
	autoComplete: 'autocomplete',
	autoFocus: 'autofocus',
	autoPlay: 'autoplay',
	encType: 'enctype',
	hrefLang: 'hreflang',
}

const MAX_REACTIVE_RESOLVE_STEPS = 16

const resolveReactiveValue = (value)=> {
	let resolved = value
	let steps = 0

	while (steps < MAX_REACTIVE_RESOLVE_STEPS){
		if (resolved == null){
			break
		}

		if (isSignal(resolved) || isComputed(resolved)){
			resolved = resolved()
			steps++
			continue
		}

		if (typeof resolved === 'function'){
			resolved = resolved()
			steps++
			continue
		}

		break
	}

	return resolved
}

const createReactiveTextNode = (reactiveValue)=> {
	const textNode = document.createTextNode('')
	let prev = textNode.data

	createBindingEffect(()=> {
		const next = normalizeTextNodeValue(resolveReactiveValue(reactiveValue))
		if (prev === next){
			return
		}
		textNode.data = next
		prev = next
	})

	return textNode
}

const createReactiveChildNode = (reactiveValue)=> {
	const start = document.createComment('dynamic-start')
	const end = document.createComment('dynamic-end')
	const fragment = document.createDocumentFragment()
	fragment.append(start, end)
	let mountedNodes = []

	createBindingEffect(()=> {
		const nextNode = node2Element(resolveReactiveValue(reactiveValue))
		const parent = end.parentNode
		if (!parent){
			return
		}

		mountedNodes.forEach((node)=> {
			if (node.parentNode === parent){
				parent.removeChild(node)
			}
		})
		mountedNodes = []

		if (nextNode instanceof DocumentFragment){
			mountedNodes = [...nextNode.childNodes]
			parent.insertBefore(nextNode, end)
			return
		}

		mountedNodes = [nextNode]
		parent.insertBefore(nextNode, end)
	})

	return fragment
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

const applyClassProp = (element, value)=> {
	if (isReactive(value)){
		createBindingEffect(()=> {
			const expectedClass = toClassMap(resolveReactiveValue(value))
			const actualClass = new Set(element.classList)
			const shouldRemove = [...actualClass].filter(className=> !expectedClass.has(className))
			const combinedClassMap = new Map([...expectedClass, ...shouldRemove.map(className=> [className, false])])
			applyClassNameMap(element, combinedClassMap)
		})
		return
	}

	applyClassNameMap(element, toClassMap(value))
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

const clearStyleKey = (element, key)=> {
	if (key.startsWith('--')){
		element.style.removeProperty(key)
	} else {
		element.style[key] = ''
	}
}

const applyStyleProp = (element, value)=> {
	if (isReactive(value)){
		let prevKeys = new Set()
		createBindingEffect(()=> {
			const resolved = resolveReactiveValue(value)
			if (typeof resolved === 'string' || resolved == null){
				element.style.cssText = resolved ?? ''
				prevKeys = new Set()
			} else if (typeof resolved === 'object'){
				prevKeys.forEach((key)=> {
					if (!(key in resolved)){
						clearStyleKey(element, key)
					}
				})
				applyStyleObject(element, resolved)
				prevKeys = new Set(Object.keys(resolved))
			}
		})
		return
	}

	if (typeof value === 'string'){
		element.style.cssText = value
		return
	}

	if (value && typeof value === 'object'){
		applyStyleObject(element, value)
	}
}

const clearDomProp = (element, key)=> {
	if (key in element){
		element[key] = ''
	}

	element.removeAttribute(key)
}

// Apply a prop value directly to the DOM. Reactive props reuse this same path inside effects.
const setDomProp = (element, key, value)=> {
	if (isBooleanDomProp(element, key)){
		const next = Boolean(value)
		const prev = element[key]
		const hasAttribute = element.hasAttribute(key)
		if (prev === next && (next && hasAttribute || !next && !hasAttribute)){
			return
		}

		element[key] = next

		if (next){
			element.setAttribute(key, '')
			return
		}

		element.removeAttribute(key)
		return
	}

	if (value == null || value === false){
		const prev = key in element ? element[key] : ''
		if (prev === '' && !element.hasAttribute(key)){
			return
		}
		clearDomProp(element, key)
		return
	}

	if (key in element){
		const prev = element[key]
		if (prev === value){
			return
		}
		element[key] = value
		return
	}

	const next = String(value)
	const prev = element.getAttribute(key)
	if (prev === next){
		return
	}
	element.setAttribute(key, next)
}

const applyCommonAttribute = (element, key, source)=> {
	if (isReactive(source)){
		createBindingEffect(()=> {
			setDomProp(element, key, resolveReactiveValue(source))
		})
		return
	}
	setDomProp(element, key, source)
}

const applyRefProp = (element, ref)=> {
	if (typeof ref !== 'function'){
		return
	}

	const assignRef = value=> ref(value)

	const owner = currentOwner
	if (owner){
		owner.refs.push(()=> {
			assignRef(element)
		})
	} else {
		assignRef(element)
	}

	if (owner || getCurrentComputation()){
		registerCleanup(()=> {
			assignRef(null)
		})
	}
}

const applyProps = (element, props = {})=> {
	const entries = Object.entries(props)
	entries.forEach(([key, value])=> {
		if (key === 'children'){
			return
		}

		if (key === 'classList'){
			throw new Error('classList prop is not supported. Use className instead.')
		}

		if (key === 'className'){
			applyClassProp(element, value)
			return
		}

		if (isEventProp(key)){
			if (typeof value === 'function'){
				const eventName = key.slice(2).toLowerCase()
				if (isSupportedEvent(element, eventName)){
					element.addEventListener(eventName, value)
					// Register cleanup to remove event listener if in owner context
					if (currentOwner || getCurrentComputation()){
						registerCleanup(()=> {
							element.removeEventListener(eventName, value)
						})
					}
				}
			}
			return
		}

		if (key === 'style'){
			applyStyleProp(element, value)
			return
		}

		if (key === 'ref'){
			applyRefProp(element, value)
			return
		}

		const domKey = JSX_PROP_MAP[key] ?? key
		applyCommonAttribute(element, domKey, value)
	})
	return element
}

// Normalize any JSX return value into a DOM node that can be appended safely.
const node2Element = (node)=> {
	if (node === null || node === undefined){
		return createPlaceholder()
	}
	if (isReactivePrimitive(node)){
		return createReactiveTextNode(node)
	}
	if (typeof node === 'function'){
		return createReactiveChildNode(node)
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

const {
	mountDynamic,
	Either,
	True,
	False,
	Match,
	Case,
	Default,
	Loop,
	Portal,
} = createControlFlow({
	createOwner,
	runOwnerMounts,
	runWithOwner,
	disposeOwner,
	createBindingEffect,
	renderInOwner,
	getCurrentOwner,
	registerCleanup,
})

// Thin runtime helper for <Dynamic component={tag} ...props />.
// `component` is treated as the tag argument for `h`.
const Dynamic = ({ component, ...props })=> {
	const dynamicTag = isReactivePrimitive(component) ? component() : component
	return h(dynamicTag, props)
}

const h = (tag, props, ...children)=> {
	const nextProps = props || {}
	const propChildren = nextProps.children ?? []
	const normalizedPropChildren = Array.isArray(propChildren) ? propChildren : [propChildren]
	const mergedChildren = [...normalizedPropChildren, ...children]

	if (tag === Fragment){
		// Fragments produce a DocumentFragment so no wrapper element is introduced.
		const fragment = document.createDocumentFragment()
		appendChildren(fragment, mergedChildren)
		return fragment
	}

	if (typeof tag === 'function'){
		// Create an owner for this component instance
		const owner = createOwner(currentOwner)

		// Function components receive a single props object; children are injected under props.children.
		const componentProps = { ...nextProps, children: mergedChildren.length === 1 ? mergedChildren[0] : mergedChildren }
		const result = runWithOwner(owner, ()=> tag(componentProps))
		const normalized = renderInOwner(owner, result)

		// Attach owner to result for unmount tracking
		if (normalized instanceof Node){
			normalized[OWNER] = owner
		}

		return normalized
	}

	if (typeof tag !== 'string'){
		throw new Error('Only static string tags and Fragment are supported.')
	}

	// Native tags create real DOM elements directly without a virtual DOM layer.
	const SVG_TAGS = new Set(['svg', 'animate', 'animateMotion', 'animateTransform', 'circle', 'clipPath', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'foreignObject', 'g', 'image', 'line', 'linearGradient', 'marker', 'mask', 'metadata', 'mpath', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect', 'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'tspan', 'use', 'view'])
	const element = SVG_TAGS.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag)
	applyProps(element, nextProps)
	appendChildren(element, mergedChildren)
	return element
}

const jsx = (tag, props, key)=> h(tag, key === undefined ? props : { ...props, key })
const jsxs = (tag, props, key)=> h(tag, key === undefined ? props : { ...props, key })

// Render by appending the normalized root node into the target container.
// Returns a disposer function that cleans up all effects and listeners.
const renderApp = (container, node)=> {
	const appNode = node2Element(node)
	container.appendChild(appNode)
	// Get the owner from the node (set by h() when rendering components)
	const owner = appNode[OWNER]
	// Execute root onMount callbacks if owner exists
	if (owner){
		runOwnerMounts(owner)
	}

	// Return a disposer function
	let disposed = false
	const dispose = ()=> {
		if (disposed){ return }
		disposed = true
		if (owner){
			disposeOwner(owner)
		}
		if (appNode.parentNode === container){
			container.removeChild(appNode)
		}
	}

	return dispose
}

export {
	// Public API
	Fragment,
	h,
	jsx,
	jsxs,
	onMount,
	onUnmount,
	createContext,
	useContext,
	renderApp,
	// Internal signal primitives (framework internals/tests)
	createComputed,
	createSignal,
	createTree,
	toRaw,
	isTree,
	// Owner / lifecycle internals
	createOwner,
	runOwnerMounts,
	runWithOwner,
	disposeOwner,
	createBindingEffect,
	registerCleanup,
	// Reactive helpers
	isReactivePrimitive,
	isReactive,
	// DOM helpers
	createPlaceholder,
	flattenChildren,
	isEventProp,
	isSupportedEvent,
	isBooleanDomProp,
	JSX_PROP_MAP,
	normalizeTextNodeValue,
	createReactiveTextNode,
	toClassTokens,
	toClassMap,
	applyClassNameMap,
	applyClassProp,
	applyStyleObject,
	clearStyleKey,
	applyStyleProp,
	applyRefProp,
	clearDomProp,
	setDomProp,
	applyCommonAttribute,
	applyProps,
	node2Element,
	appendChild,
	appendChildren,
	// Control flow
	mountDynamic,
	Either,
	True,
	False,
	Match,
	Case,
	Default,
	Loop,
	Portal,
	Dynamic,
}
