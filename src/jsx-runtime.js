import {
	createComputed, createSignal, createTree, effect, isComputed, isSignal, isTree, toRaw,
} from './reactivity.js'
import {
	flattenChildren, isEventProp, normalizeTextNodeValue, toClassMap, toClassTokens,
} from './utils.js'

const Fragment = Symbol('Fragment')
const OWNER = Symbol('owner')

// ============ Owner & Lifecycle Management ============
// Global context for effect scoping and cleanup tracking
let currentOwner = null
let currentComputation = null

const createOwner = (parent = null)=> {
	const owner = {
		parent,
		children: new Set(),
		cleanups: [],
		effects: [],
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
		const prevComp = currentComputation
		currentComputation = { cleanups: local }
		runner()
		currentComputation = prevComp
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

const isReactivePrimitive = value=> isSignal(value) || isComputed(value)
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

const createReactiveTextNode = (reactiveValue)=> {
	const textNode = document.createTextNode('')

	createBindingEffect(()=> {
		textNode.data = normalizeTextNodeValue(reactiveValue())
	})

	return textNode
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
			const expectedClass = toClassMap(value())
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
			const resolved = value()
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
	if (isReactive(source)){
		createBindingEffect(()=> {
			setDomProp(element, key, source())
		})
		return
	}
	setDomProp(element, key, source)
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
					if (currentOwner || currentComputation){
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

		const domKey = JSX_PROP_MAP[key] ?? key
		applyCommonAttribute(element, domKey, value)
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

// ============ Control Flow Primitives ============

// Reactively replaces DOM content after a comment anchor.
// getContent() is called inside a binding effect — any signals it reads
// will trigger a branch switch when they change.
// On each switch: the previous branch owner is disposed (cleaning up all its
// effects and event listeners), its DOM nodes are removed, and the new branch
// is rendered in a fresh child owner.
const mountDynamic = (anchor, getContent)=> {
	let prevNodes = []
	let prevOwner = null
	// Capture the Either component's owner at call time so branch owners are always
	// parented correctly even when the effect re-runs outside component context.
	const hostOwner = currentOwner

	const update = ()=> {
		if (prevOwner){
			disposeOwner(prevOwner)
			prevOwner = null
		}
		prevNodes.forEach(n=> n.remove())
		prevNodes = []

		const owner = createOwner(hostOwner)
		const prevComp = currentComputation
		currentComputation = null
		const result = runWithOwner(owner, getContent)
		const node = renderInOwner(owner, result ?? null)
		currentComputation = prevComp

		// Collect child refs before insertion: DocumentFragment drains on append
		if (node instanceof DocumentFragment){
			prevNodes = [...node.childNodes]
		} else {
			prevNodes = [node]
		}

		anchor.after(node)
		prevOwner = owner

		// For reactive updates (anchor already in live DOM), trigger mount hooks now.
		// For the initial render, renderApp will call runOwnerMounts on the full tree.
		if (anchor.isConnected){
			runOwnerMounts(owner)
		}
	}

	const stop = createBindingEffect(update)

	return ()=> {
		if (typeof stop === 'function'){
			stop()
		}
		if (prevOwner){
			disposeOwner(prevOwner)
			prevOwner = null
		}
		prevNodes.forEach(n=> n.remove())
		prevNodes = []
	}
}

// <True> and <False> are transparent slot markers — they pass children through.
// The Babel plugin wraps them in lazy arrow functions before Either ever sees them,
// so the inactive branch is never evaluated until needed.
const True = ({ children })=> children
const False = ({ children })=> children

// <Either condition={...}>
//   <True>…</True>
//   <False>…</False>
// </Either>
//
// The Babel plugin transforms this into:
//   <Either condition={...} trueBranch={() => <True>…</True>} falseBranch={() => <False>…</False>} />
// so branches are only rendered when active.
const Either = ({
	condition, trueBranch, falseBranch,
})=> {
	const anchor = document.createComment('if')
	// Return a fragment so the anchor and initial branch content land in the
	// parent as siblings. anchor.after() keeps working once in the live DOM.
	const fragment = document.createDocumentFragment()
	fragment.appendChild(anchor)
	const activeTrue = trueBranch
	const activeFalse = falseBranch

	mountDynamic(anchor, ()=> {
		const cond = typeof condition === 'function' ? condition() : condition
		const branch = cond ? activeTrue : activeFalse
		return branch ? branch() : null
	})

	return fragment
}

// <Loop each={items}>{(item, index) => ...}</Loop>
//
// Rows are tracked by identity (object reference / primitive value).
const Loop = ({
	each,
	children,
})=> {
	const anchor = document.createComment('for')
	const fragment = document.createDocumentFragment()
	fragment.appendChild(anchor)

	const hostOwner = currentOwner
	let rows = []

	const resolveList = ()=> {
		const list = typeof each === 'function' ? each() : each
		return Array.isArray(list) ? list : []
	}

	const renderRow = (item, indexValue)=> {
		const owner = createOwner(hostOwner)
		const indexSignal = createSignal(indexValue)
		const prevComp = currentComputation
		currentComputation = null
		const result = runWithOwner(owner, ()=> {
			if (typeof children !== 'function'){
				return null
			}

			return children(item, indexSignal)
		})
		const node = renderInOwner(owner, result)
		currentComputation = prevComp
		const nodes = node instanceof DocumentFragment ? [...node.childNodes] : [node]

		return {
			owner,
			indexSignal,
			nodes,
		}
	}

	const mountRows = (nextRows)=> {
		const nodeFragment = document.createDocumentFragment()
		nextRows.forEach((row)=> {
			row.nodes.forEach((node)=> {
				nodeFragment.appendChild(node)
			})
		})
		anchor.before(nodeFragment)
	}

	const reconcileRows = (nextItems)=> {
		const prevRows = rows
		const nextRows = new Array(nextItems.length)
		const createdRows = []
		const reusedPrevIndices = new Set()

		// Build lookup: identity → [prevIndex, ...] (buckets handle duplicates).
		const prevRowsByIdentity = new Map()
		prevRows.forEach((row, prevIndex)=> {
			const bucket = prevRowsByIdentity.get(row.identity)
			if (bucket){
				bucket.push(prevIndex)
			} else {
				prevRowsByIdentity.set(row.identity, [prevIndex])
			}
		})

		// Match existing rows by identity.
		nextItems.forEach((item, nextIndex)=> {
			const bucket = prevRowsByIdentity.get(item)
			if (!bucket || bucket.length === 0){
				return
			}

			const prevIndex = bucket.shift()
			nextRows[nextIndex] = prevRows[prevIndex]
			reusedPrevIndices.add(prevIndex)
		})

		// Create missing rows.
		for (let nextIndex = 0; nextIndex < nextRows.length; nextIndex++){
			const row = nextRows[nextIndex]
			if (row){
				row.indexSignal(nextIndex)
				continue
			}

			const created = renderRow(nextItems[nextIndex], nextIndex)
			created.identity = nextItems[nextIndex]
			nextRows[nextIndex] = created
			createdRows.push(created)
		}

		// Dispose rows that were not reused.
		prevRows.forEach((row, prevIndex)=> {
			if (reusedPrevIndices.has(prevIndex)){
				return
			}

			disposeOwner(row.owner)
			row.nodes.forEach(node=> node.remove())
		})

		rows = nextRows
		mountRows(rows)

		if (anchor.isConnected){
			createdRows.forEach((row)=> {
				runOwnerMounts(row.owner)
			})
		}
	}

	const stop = createBindingEffect(()=> {
		const nextItems = resolveList()
		reconcileRows(nextItems)
	})

	registerCleanup(()=> {
		if (typeof stop === 'function'){
			stop()
		}

		rows.forEach((row)=> {
			disposeOwner(row.owner)
			row.nodes.forEach(node=> node.remove())
		})
		rows = []
	})

	return fragment
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
	const element = document.createElement(tag)
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
	Loop,
}
