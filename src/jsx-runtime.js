import {
	batch, createComputed, createSignal, createTree, effect, isComputed, isSignal, isTree, runUntracked, toRaw,
} from './reactivity.js'
import { getActiveSub, setActiveSub } from 'alien-signals'
import {
	flattenChildren, isEventProp, normalizeTextNodeValue, toClassMap, toClassTokens,
} from './utils.js'
import { getCurrentComputation, setCurrentComputation } from './computation-context.js'
import { createControlFlow } from './control-flow.js'
import { hasMergedPropsStaticKeys, isMergedProps, mergeProps } from './merge-props.js'

const Fragment = Symbol('Fragment')
const OWNER = Symbol('owner')
const COMPONENT_DESCRIPTOR = Symbol('component-descriptor')
const PENDING_DESCRIPTORS = Symbol('pending-descriptors')

// ============ Owner & Lifecycle Management ============
// Global context for effect scoping and cleanup tracking
let currentOwner = null

const CONTEXT_ID = Symbol('context-id')

const getCurrentOwner = ()=> currentOwner

// Owner fields are lazily allocated. Most components register nothing
// (no onMount, no context, no refs), so paying for a Set + Map + 4 arrays
// per component dominated mount cost. Allocate each collection only on first
// use. Readers must tolerate `undefined`.
const createOwner = (parent = null)=> {
	const owner = {
		parent,
		children: undefined,
		cleanups: undefined,
		effects: undefined,
		contexts: undefined,
		refs: undefined,
		mounts: undefined,
		mounted: false,
	}
	if (parent){
		(parent.children ??= new Set()).add(owner)
	}
	return owner
}

const runOwnerMounts = (owner)=> {
	runUntracked(()=> {
		owner.children?.forEach(child=> runOwnerMounts(child))
		owner.refs?.forEach((fn)=> { fn() })
		owner.mounts?.forEach((fn)=> { fn() })
		owner.mounted = true
	})
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

// Reactive child updates can insert plain DOM wrappers that contain mounted
// component roots deeper in the subtree, so walk the inserted nodes and run
// any deferred owner mounts we find.
const mountOwnedSubtree = (node)=> {
	if (!(node instanceof Node)){
		return
	}

	const stack = [node]
	while (stack.length){
		const current = stack.pop()
		const owner = current[OWNER]
		if (owner && !owner.mounted && current.isConnected){
			runOwnerMounts(owner)
		}

		for (const child of current.childNodes){
			stack.push(child)
		}
	}
}

const disposeOwner = (owner)=> {
	if (owner.parent){
		owner.parent.children?.delete(owner)
	}

	// Dispose all child owners recursively
	if (owner.children){
		owner.children.forEach(child=> disposeOwner(child))
		owner.children.clear()
	}

	// Stop owner-bound effects for this scope during unmount.
	if (owner.effects){
		for (let i = owner.effects.length - 1; i >= 0; i -= 1){
			const stop = owner.effects[i]
			if (typeof stop === 'function') stop()
		}
		owner.effects.length = 0
	}

	if (owner.cleanups){
		for (let i = owner.cleanups.length - 1; i >= 0; i -= 1){
			const cleanup = owner.cleanups[i]
			if (typeof cleanup === 'function') cleanup()
		}
		owner.cleanups.length = 0
	}
	if (owner.refs) owner.refs.length = 0
	if (owner.mounts) owner.mounts.length = 0
}

const flushCleanups = (list)=> {
	runUntracked(()=> {
		[...list].reverse().forEach((l)=> {
			l()
		})
		list.length = 0
	})
}

// Create a binding effect that integrates with the owner system
const createBindingEffect = (runner)=> {
	const owner = currentOwner
	// effect-level cleanups (run before each re-execution)
	const local = []

	const stop = effect(()=> {
		// Run effect-level cleanups in reverse order, untracked to avoid accidental dependency registration
		flushCleanups(local)

		// Set up computation context for onCleanup within the effect
		const prevComp = getCurrentComputation()
		setCurrentComputation({ cleanups: local })
		// Restore the owner captured at creation time so that:
		// 1. appendChild defers component-descriptor children (requires currentOwner != null)
		// 2. createOwner() chains new owners under the correct parent on re-fires
		const prevOwner = currentOwner
		currentOwner = owner
		try {
			runner()
		} finally {
			setCurrentComputation(prevComp)
			currentOwner = prevOwner
		}
	})

	if (!owner){
		return stop
	}
	// Register effect and its disposal in the owner
	(owner.effects ??= []).push(stop)
	;(owner.cleanups ??= []).push(()=> {
		// Run remaining local cleanups, untracked to avoid accidental dependency registration
		flushCleanups(local)
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
		(currentOwner.cleanups ??= []).push(fn)
	}
}

// Public API: onMount - register function to run after mount
const onMount = (fn)=> {
	if (!currentOwner){
		throw new Error('onMount must be called within a component scope')
	}
	(currentOwner.mounts ??= []).push(fn)
}

const onUnmount = (fn)=> {
	if (!currentOwner){
		throw new Error('onUnmount must be called within a component scope')
	}
	(currentOwner.cleanups ??= []).push(fn)
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

		(currentOwner.contexts ??= new Map()).set(context[CONTEXT_ID], value)

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
		if (owner.contexts?.has(context[CONTEXT_ID])){
			return owner.contexts.get(context[CONTEXT_ID])
		}
		owner = owner.parent
	}

	return context.defaultValue
}

const createComponentDescriptor = (tag, props, children)=> ({
	[COMPONENT_DESCRIPTOR]: true,
	tag,
	props,
	children,
	instance: null,
})

const isComponentDescriptor = value=> value != null && typeof value === 'object' && value[COMPONENT_DESCRIPTOR] === true

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
	// In practice this loop resolves in at most 2 steps. The known chains are:
	//   signal → primitive         (1 step)
	//   computed → primitive       (1 step)
	//   function → primitive       (1 step)
	//   signal → tree              (1 step, tree is an object so the loop stops)
	//   signal → function → value  (2 steps)
	//   computed → function → value (2 steps)
	// signal→signal is forbidden by createSignal; signal→computed triggers a warning.
	// The loop is kept rather than hard-coding 2 steps because a function returning
	// a function (e.g. const fn = () => () => 'red'; <div style={fn} />) is a grey
	// area that the framework does not explicitly forbid, and silently mis-resolving
	// it would be worse than the negligible cost of an extra iteration.
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

const materializeComponentDescriptor = (descriptor)=> {
	if (descriptor.instance instanceof Node){
		return descriptor.instance
	}

	const owner = createOwner(currentOwner)
	let componentProps = descriptor.props ?? {}

	// Legacy `h(Comp, props, ...children)` carries variadic children alongside
	// props. Compiled JSX always packs children into the proxy itself, leaving
	// descriptor.children empty. Layer any extra variadic children on top via
	// mergeProps so the proxy contract holds for both call shapes.
	if (descriptor.children && descriptor.children.length > 0){
		const kids = descriptor.children.length === 1 ? descriptor.children[0] : descriptor.children
		componentProps = mergeProps(componentProps, { children: kids })
	}

	// Fuse the owner swap and untracked context into one try/finally. Inlining
	// avoids the runUntracked closure + extra try/finally per component, which
	// shows up in profile (3000 components × these wrappers was a meaningful
	// share of mount time).
	const prevOwner = currentOwner
	const prevSub = getActiveSub()
	currentOwner = owner
	setActiveSub(undefined)
	let normalized
	try {
		normalized = node2Element(descriptor.tag(componentProps))
	} finally {
		currentOwner = prevOwner
		setActiveSub(prevSub)
	}

	if (normalized instanceof DocumentFragment){
		// A fragment is drained the moment it is appended into its parent, so an
		// OWNER assigned on the fragment itself would be lost. Anchor it on the
		// fragment's first child instead — that node stays connected in the live
		// DOM at the component's position, and mountOwnedSubtree's childNodes
		// walk picks it up. createReactiveChildNode emits a stable
		// `dynamic-start` comment as firstChild for this exact purpose.
		if (normalized.firstChild){
			normalized.firstChild[OWNER] = owner
		}
	} else if (normalized instanceof Node){
		normalized[OWNER] = owner
	}

	descriptor.instance = normalized
	return normalized
}

const createReactiveChildNode = (reactiveValue)=> {
	const start = document.createComment('dynamic-start')
	const end = document.createComment('dynamic-end')
	const fragment = document.createDocumentFragment()
	fragment.append(start, end)
	let mountedNodes = []

	createBindingEffect(()=> {
		const nextNode = node2Element(resolveReactiveValue(reactiveValue))
		// When the reactive value produced an array, node2Element returns a
		// fragment with deferred component/thunk children. Flush them now before
		// insertBefore drains the fragment — once drained, PENDING_DESCRIPTORS is
		// unreachable. currentOwner is correctly set here because createBindingEffect
		// restores the owner captured at creation time.
		if (nextNode instanceof DocumentFragment && nextNode[PENDING_DESCRIPTORS]){
			flushPendingDescriptors(nextNode)
		}
		const parent = end.parentNode
		if (!parent){
			return
		}

		mountedNodes.forEach((node)=> {
			if (node.parentNode){
				node.parentNode.removeChild(node)
			}
		})
		mountedNodes = []

		if (nextNode instanceof DocumentFragment){
			mountedNodes = [...nextNode.childNodes]
		} else {
			mountedNodes = [nextNode]
		}

		parent.insertBefore(nextNode, end)
		if (start.isConnected){
			mountedNodes.forEach(node=> mountOwnedSubtree(node))
		}
	})

	// The fragment is drained the moment it's appended into the parent, so the
	// start/end markers and mountedNodes become free-standing children of that
	// parent. Without this cleanup, disposing the owner stops the binding effect
	// but leaves the DOM nodes behind (visible as the fragment-root disposer
	// regression). Only register if we're inside an owner/computation scope —
	// some standalone render helpers materialize without one.
	if (currentOwner || getCurrentComputation()){
		registerCleanup(()=> {
			mountedNodes.forEach((node)=> {
				if (node.parentNode){
					node.parentNode.removeChild(node)
				}
			})
			mountedNodes = []
			if (start.parentNode){
				start.parentNode.removeChild(start)
			}
			if (end.parentNode){
				end.parentNode.removeChild(end)
			}
		})
	}

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

// Apply a className value to an element. Always reconciles against the
// element's current classList so re-runs (e.g. via an enclosing binding
// effect) drop tokens that disappeared from the new value.
// NOTE: `value` must already be unwrapped before calling this function.
// Do not pass signals, computeds, or accessor thunks — callers are
// responsible for resolving reactive values via `resolveReactiveValue` first.
const applyClassProp = (element, value)=> {
	const expectedClass = toClassMap(value)
	const actualClass = new Set(element.classList)
	const shouldRemove = [...actualClass].filter(className=> !expectedClass.has(className))
	const combinedClassMap = new Map([...expectedClass, ...shouldRemove.map(className=> [className, false])])
	applyClassNameMap(element, combinedClassMap)
}
const applyStyleObject = (element, styles, prevStyles = {})=> {
	const nextStyles = styles ?? {}

	Object.keys(prevStyles).forEach((property)=> {
		if (nextStyles[property] != null && nextStyles[property] !== false){
			return
		}

		clearStyleKey(element, property)
		delete prevStyles[property]
	})

	Object.entries(nextStyles).forEach(([property, value])=> {
		if (value == null || value === false){
			return
		}

		const nextValue = String(value)
		if (prevStyles[property] === nextValue){
			return
		}

		if (property.startsWith('--')){
			element.style.setProperty(property, nextValue)
		} else {
			element.style[property] = nextValue
		}

		prevStyles[property] = nextValue
	})

	return prevStyles
}

const clearStyleKey = (element, key)=> {
	if (key.startsWith('--')){
		element.style.removeProperty(key)
	} else {
		element.style[key] = ''
	}
}

// NOTE: `value` must already be unwrapped before calling this function.
// Do not pass signals, computeds, or accessor thunks — callers are
// responsible for resolving reactive values via `resolveReactiveValue` first.
const applyStyleProp = (element, value, prevValue)=> {
	if (value == null || value === false){
		element.style.cssText = ''
		return undefined
	}

	if (typeof value === 'string'){
		element.style.cssText = value
		return value
	}

	if (typeof value === 'object'){
		return applyStyleObject(element, value, typeof prevValue === 'string' ? undefined : prevValue)
	}

	return prevValue
}

const clearDomProp = (element, key)=> {
	if (key in element){
		try {
			element[key] = ''
		} catch {
			// Some DOM properties (for example HTMLInputElement.form) are readonly.
		}
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
		// Skip removal for aria-* when value is false — some ATs distinguish
		// aria-hidden="false" (visible) from a missing attribute (also visible but unreliable),
		// so we must keep the attribute present even when falsey.
		if (!(value === false && typeof key === 'string' && key.startsWith('aria-'))){
			const prev = key in element ? element[key] : ''
			if (prev === '' && !element.hasAttribute(key)){
				return
			}
			clearDomProp(element, key)
			return
		}
	}

	if (key in element){
		const prev = element[key]
		if (prev === value){
			return
		}
		try {
			element[key] = value
			return
		} catch {
			// Fall through to attribute writes for readonly DOM properties.
		}
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
	
	if (owner && !owner.mounted) {
		(owner.refs ??= []).push(() => assignRef(element))
	} else {
		assignRef(element)
	}

	if (owner || getCurrentComputation()){
		registerCleanup(()=> {
			assignRef(null)
		})
	}
}

// Bind a single non-event, non-special prop key to the DOM element. Each
// individual prop runs inside its own binding effect so a signal change in
// one prop's getter only re-writes that one attribute. For plain (non-proxy)
// props the inner effect runs once with no dependencies and is essentially
// free. The value is resolved through `resolveReactiveValue` so signals and
// zero-arg accessor thunks (used widely by ark-plastic / zag adapters) are
// unwrapped before being applied to the DOM.
const bindReactiveProp = (element, props, key, propsIsTracked)=> {
	const rawValue = props[key]

	// Static (non-reactive) fast path: write the prop directly with no binding
	// effect. Most JSX props in real apps are static (className='row', id=...,
	// type='button' etc.) — building an effect for each one was the biggest
	// per-component cost in mount benchmarks.
	// Skip the fast path when `props` is itself a tracking proxy (tree /
	// mergeProps): the value may be a plain string but reading `props[key]`
	// subscribes through the proxy, so we need an effect to re-run on change.
	if (!propsIsTracked && !isReactive(rawValue)){
		let prevStyleValue
		if (key === 'className' || key === 'class'){
			applyClassProp(element, rawValue)
		} else if (key === 'style'){
			prevStyleValue = applyStyleProp(element, rawValue, undefined)
		} else {
			const domKey = JSX_PROP_MAP[key] ?? key
			setDomProp(element, domKey, rawValue)
		}

		return ()=> {
			if (key === 'className' || key === 'class'){
				element.removeAttribute('class')
				return
			}
			if (key === 'style'){
				if (prevStyleValue && typeof prevStyleValue === 'object'){
					Object.keys(prevStyleValue).forEach(prop=> clearStyleKey(element, prop))
				} else if (typeof prevStyleValue === 'string'){
					element.style.cssText = ''
				}
				return
			}
			const domKey = JSX_PROP_MAP[key] ?? key
			clearDomProp(element, domKey)
		}
	}

	let prevStyleValue
	const stop = createBindingEffect(()=> {
		const value = resolveReactiveValue(props[key])
		if (key === 'className' || key === 'class'){
			applyClassProp(element, value)
			return
		}
		if (key === 'style'){
			prevStyleValue = applyStyleProp(element, value, prevStyleValue)
			return
		}
		const domKey = JSX_PROP_MAP[key] ?? key
		setDomProp(element, domKey, value)
	})

	return ()=> {
		stop?.()
		if (key === 'className' || key === 'class'){
			element.removeAttribute('class')
			return
		}
		if (key === 'style'){
			// Only clear style properties that Plastic itself set, preserving any
			// inline styles written directly to the DOM by third-party libraries
			// (e.g. Zag's pointer-events management via assignPointerEventToLayers).
			if (prevStyleValue && typeof prevStyleValue === 'object'){
				Object.keys(prevStyleValue).forEach(prop=> clearStyleKey(element, prop))
			} else if (typeof prevStyleValue === 'string'){
				element.style.cssText = ''
			}
			return
		}
		const domKey = JSX_PROP_MAP[key] ?? key
		clearDomProp(element, domKey)
	}
}

// Attach a single listener that resolves the current handler from `props` at
// dispatch time. This makes handlers reactive without re-attaching listeners:
// when a parent's signal changes the handler reference, the next event read
// sees the new function via the proxy.
const bindReactiveEvent = (element, props, key)=> {
	const eventName = key.slice(2).toLowerCase()
	if (!isSupportedEvent(element, eventName)){
		return ()=> {}
	}
	const listener = (...args)=> {
		const handler = props[key]
		if (typeof handler === 'function'){
			handler(...args)
		}
	}
	element.addEventListener(eventName, listener)
	if (currentOwner || getCurrentComputation()){
		registerCleanup(()=> {
			element.removeEventListener(eventName, listener)
		})
	}

	return ()=> {
		element.removeEventListener(eventName, listener)
	}
}

// Apply a props object (plain object or mergeProps proxy) to a DOM element.
// Each prop gets its own binding effect so a change to one signal only
// re-writes that one attribute. The enclosing binding effect tracks
// `Reflect.ownKeys(props)`, so when a dynamic spread source adds or removes
// keys later we tear down the previous bindings and rebuild them from the
// current key set.
const applyProps = (element, props = {})=> {
	const propsIsTracked = isMergedProps(props) || isTree(props)
	// Per-key disposer map. Re-runs of the outer key-tracking effect diff the
	// previous and current key set so only added/removed keys touch the DOM;
	// surviving keys keep their per-prop binding (which already short-circuits
	// on prev===next inside setDomProp). Tearing down all bindings on every
	// signal change was the cause of NO-OP attribute thrash on Zag widgets.
	const bindings = new Map()

	const createBindingForKey = (key)=> {
		if (key === 'classList'){
			throw new Error('classList prop is not supported. Use className instead.')
		}
		// Suppress the outer effect's computation context so inner
		// registerCleanup calls (event listeners, ref nulling) attach to the
		// owner rather than the outer effect's per-run cleanup list. Otherwise
		// flushCleanups on the next outer re-run would tear down listeners for
		// keys we intend to keep.
		// Also clear alien-signals' activeSub so each per-key inner effect is
		// a root effect, not a child of the outer key-tracking effect — child
		// effects get auto-disposed when the parent re-runs, which would kill
		// surviving keys' bindings.
		const prevComp = getCurrentComputation()
		const prevSub = getActiveSub()
		setCurrentComputation(null)
		setActiveSub(undefined)
		try {
			if (key === 'ref'){
				const ref = props[key]
				applyRefProp(element, ref)
				return ()=> {
					if (typeof ref === 'function'){
						ref(null)
					}
				}
			}
			if (isEventProp(key)){
				return bindReactiveEvent(element, props, key)
			}
			return bindReactiveProp(element, props, key, propsIsTracked)
		} finally {
			setCurrentComputation(prevComp)
			setActiveSub(prevSub)
		}
	}

	const setup = ()=> {
		const nextKeys = new Set()
		for (const key of Reflect.ownKeys(props)){
			if (typeof key === 'symbol' || key === 'children' || key === 'key'){
				continue
			}
			nextKeys.add(key)
		}

		// Dispose bindings for keys that disappeared. Surviving keys are left
		// alone — their inner binding effects already react to value changes.
		for (const [key, dispose] of bindings){
			if (nextKeys.has(key)) continue
			if (typeof dispose === 'function') dispose()
			bindings.delete(key)
		}

		for (const key of nextKeys){
			if (bindings.has(key)) continue
			bindings.set(key, createBindingForKey(key))
		}
	}

	// Register full teardown at the owner level (not the outer effect's local
	// cleanup list) so it fires only on real unmount.
	if (currentOwner || getCurrentComputation()){
		registerCleanup(()=> {
			for (const dispose of bindings.values()){
				if (typeof dispose === 'function') dispose()
			}
			bindings.clear()
		})
	}

	// Only wrap in an outer binding effect when the proxy has dynamic keys (a
	// function-typed spread source like `{...api()}`, or any tree proxy whose
	// key set may grow/shrink at runtime). For static-key proxies (the common
	// babel reactive transform output with no spreads), and for plain object
	// props, keys never change — skip the outer effect to avoid one
	// owner-effect allocation per element.
	if ((isMergedProps(props) && !hasMergedPropsStaticKeys(props)) || isTree(props)){
		createBindingEffect(setup)
	} else {
		setup()
	}
	return element
}

// Normalize any JSX return value into a DOM node that can be appended safely.
// Dispatch is organized as a `typeof` switch so the engine can lower it to a
// jump table, and the most frequent shapes are handled first:
//   - 'string'/'number': text children like `["item ", i]` (hottest in lists)
//   - 'object' → Node: the Element returned from a component body
//   - 'object' → descriptor: child components in an array
// Within the 'object' arm we use `node.nodeType != null` instead of
// `instanceof Node`, since a property read is cheaper than walking the
// prototype chain, and we read the descriptor symbol directly to skip the
// redundant `typeof === 'object'` check inside isComponentDescriptor.
const node2Element = (node)=> {
	switch (typeof node){
		case 'string':
		case 'number':
			return document.createTextNode(String(node))
		case 'function':
			// Signals and computeds are functions too (alien-signals binds an
			// operator function) — they render as reactive text nodes, while a
			// plain function child is a thunk that returns dynamic content.
			if (isReactivePrimitive(node)) return createReactiveTextNode(node)
			return createReactiveChildNode(node)
		case 'undefined':
			return createPlaceholder()
		case 'object': {
			if (node === null) return createPlaceholder()
			// Real DOM node returned from h()/jsx() — by far the most common
			// 'object' case during initial mount.
			if (node.nodeType != null){
				flushPendingDescriptors(node)
				return node
			}
			if (node[COMPONENT_DESCRIPTOR] === true){
				return materializeComponentDescriptor(node)
			}
			if (Array.isArray(node)){
				const fragment = document.createDocumentFragment()
				appendChildren(fragment, node)
				// Do NOT flush here — the caller (appendChild) will transfer any pending
				// descriptors to the real parent element before draining the fragment, so
				// flushPendingDescriptors runs later with the correct owner active.
				return fragment
			}
			return createPlaceholder()
		}
		default:
			return createPlaceholder()
	}
}

const materializeNode = node=> node2Element(node)

// Walk an Element subtree and materialize any component descriptors that were
// deferred by appendChild during eager native-tag construction. Materialization
// happens with the *current* owner active, so when this is invoked from inside
// a component's renderInOwner pass, deferred children correctly chain their
// owner under that component (e.g. <Provider><div><Label/></div></Provider> —
// Label's owner.parent becomes the Provider's owner, and useContext walks find
// the Provider value).
const flushPendingDescriptors = (root)=> {
	if (!(root instanceof Element) && !(root instanceof DocumentFragment)){
		return
	}
	const stack = [root]
	while (stack.length){
		const node = stack.pop()
		const pending = node[PENDING_DESCRIPTORS]
		if (pending){
			node[PENDING_DESCRIPTORS] = undefined
			pending.forEach(({ placeholder, descriptor })=> {
				if (!placeholder.parentNode){
					return
				}
				const materialized = node2Element(descriptor)
				if (materialized instanceof DocumentFragment && materialized[PENDING_DESCRIPTORS]){
					flushPendingDescriptors(materialized)
				}
				placeholder.parentNode.replaceChild(materialized, placeholder)
			})
		}
		for (const child of node.childNodes){
			if (child instanceof Element){
				stack.push(child)
			}
		}
	}
}

// Ignore empty JSX children and append everything else after normalization.
const appendChild = (parent, child)=> {
	if (child == null){
		return parent
	}

	// Defer component-descriptor and reactive-thunk children until the
	// surrounding component owner is active. JS evaluates h() arguments eagerly,
	// so without this the inner component would materialize (or the reactive
	// binding would capture its owner) under the *outer* component's owner,
	// missing any context that the wrapping component sets in its body.
	// Thunks (`typeof child === 'function') are reactive accessors injected by
	// the babel reactive transform; they create a binding that captures
	// currentOwner, so deferring them here ensures createReactiveChildNode runs
	// later during flushPendingDescriptors with the correct owner active.
	// Only defer when we're already inside a component scope (currentOwner set)
	// — direct h() usage at the top of a script expects synchronous
	// materialization.
	if ((isComponentDescriptor(child) || typeof child === 'function') && currentOwner != null && (parent instanceof Element || parent instanceof DocumentFragment)){
		const placeholder = document.createComment('pending')
		parent.appendChild(placeholder)
		const list = parent[PENDING_DESCRIPTORS] ?? (parent[PENDING_DESCRIPTORS] = [])
		list.push({ placeholder, descriptor: child })
		return parent
	}

	// When a native element is appended inside a component scope, it may carry
	// pending component descriptors in its subtree that were deferred during
	// eager h() construction. Flushing them now (via node2Element → flushPendingDescriptors)
	// would materialize those descriptors under the current owner, which is
	// the *outer* component — not the provider that will be set up later.
	// Instead, bubble all pending descriptors from the element's subtree up to
	// the parent so they get flushed by flushPendingDescriptors with the
	// correct owner once the surrounding component finishes rendering.
	if (child instanceof Element && currentOwner != null && (parent instanceof Element || parent instanceof DocumentFragment)){
		const stack = [child]
		while (stack.length){
			const node = stack.pop()
			const pending = node[PENDING_DESCRIPTORS]
			if (pending){
				node[PENDING_DESCRIPTORS] = undefined
				const list = parent[PENDING_DESCRIPTORS] ?? (parent[PENDING_DESCRIPTORS] = [])
				list.push(...pending)
			}
			for (const grandchild of node.childNodes){
				if (grandchild instanceof Element) stack.push(grandchild)
			}
		}
		parent.appendChild(child)
		return parent
	}

	const childNode = node2Element(child)
	// When the child resolved to a fragment that carries deferred component
	// descriptors, transfer them to the real parent before draining so
	// flushPendingDescriptors can find and materialize them later with the
	// correct owner active (see the array branch in node2Element).
	if (childNode instanceof DocumentFragment && childNode[PENDING_DESCRIPTORS] && (parent instanceof Element || parent instanceof DocumentFragment)){
		const list = parent[PENDING_DESCRIPTORS] ?? (parent[PENDING_DESCRIPTORS] = [])
		list.push(...childNode[PENDING_DESCRIPTORS])
		childNode[PENDING_DESCRIPTORS] = undefined
	}
	parent.appendChild(childNode)
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
	batch,
	appendChild,
	flushPendingDescriptors,
})

// Thin runtime helper for <Dynamic component={tag} ...props />.
// `component` is treated as the tag argument for `h`.

const Dynamic = ({ component, ...props })=> {
	// Resolve signals/computed directly; also resolve zero-arg accessor thunks produced
	// by the Babel reactive plugin when `component` is a dynamic expression.
	let dynamicTag = component
	if (isReactivePrimitive(component) || typeof component === 'function' && component.length === 0){
		dynamicTag = resolveReactiveValue(component)
	}
	return h(dynamicTag, props)
}

const SVG_TAGS = new Set(['svg', 'animate', 'animateMotion', 'animateTransform', 'circle', 'clipPath', 'defs', 'desc', 'ellipse', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence', 'filter', 'foreignObject', 'g', 'image', 'line', 'linearGradient', 'marker', 'mask', 'metadata', 'mpath', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect', 'set', 'stop', 'switch', 'symbol', 'text', 'textPath', 'tspan', 'use', 'view'])

const h = (tag, props, ...children)=> {
	const nextProps = props || {}

	if (tag === Fragment){
		// Fragments produce a DocumentFragment so no wrapper element is introduced.
		const propChildren = nextProps.children ?? []
		const normalizedPropChildren = Array.isArray(propChildren) ? propChildren : [propChildren]
		const mergedChildren = [...normalizedPropChildren, ...children]
		const fragment = document.createDocumentFragment()
		appendChildren(fragment, mergedChildren)
		return fragment
	}

	if (typeof tag === 'function'){
		// Compiled JSX always packs children into the props proxy and passes no
		// variadic children; preserve the proxy as-is so component bodies read
		// `props.children` reactively. Legacy handwritten `h(Comp, props, ...kids)`
		// callers pass kids separately — forward them to the descriptor so
		// materializeComponentDescriptor can layer them into the proxy via
		// `mergeProps`.
		return createComponentDescriptor(tag, nextProps, children)
	}

	if (typeof tag !== 'string'){
		throw new Error('Only static string tags and Fragment are supported.')
	}

	// Native tags create real DOM elements directly without a virtual DOM layer.
	const element = SVG_TAGS.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag)
	applyProps(element, nextProps)

	const propChildren = nextProps.children ?? []
	const normalizedPropChildren = Array.isArray(propChildren) ? propChildren : [propChildren]
	const mergedChildren = [...normalizedPropChildren, ...children]
	appendChildren(element, mergedChildren)
	return element
}

const jsx = (tag, props, key)=> {
	if (key === undefined){
		return h(tag, props)
	}
	// Layer key on without flattening the proxy.
	return h(tag, mergeProps(props, { key }))
}
const jsxs = jsx

// Static fast path counterpart to applyProps: writes a single literal value
// straight to the DOM with no isReactive check, no binding-effect wrapper, and
// no JSX_PROP_MAP miss for the hot keys. Used exclusively by jsxStatic, which
// the babel reactive transform emits when every attribute value is provably a
// scalar literal (string/number/boolean/null) — so there is nothing to track,
// nothing to dispose, and the prop never changes after initial mount.
const applyStaticProp = (element, key, value)=> {
	if (key === 'className' || key === 'class'){
		applyClassProp(element, value)
		return
	}
	if (key === 'style'){
		applyStyleProp(element, value, undefined)
		return
	}
	setDomProp(element, JSX_PROP_MAP[key] ?? key, value)
}

// jsxStatic — emitted by the babel reactive transform when ALL of these hold:
//   - tag is a lowercase intrinsic string (no components, no Dynamic)
//   - at least one attribute, none of them spread
//   - every attribute value is a scalar literal (string/number/boolean/null)
//
// Under those conditions there are no reactive props, no event handlers, no
// refs, no merged-props proxy — applyProps' entire dispatch machinery
// (createBindingEffect / isMergedProps / Reflect.ownKeys / bindReactiveProp /
// isReactive) is pure overhead. We bypass it and write each prop directly.
// Children pass through unchanged: babel emits the same child expressions it
// would for jsx(), so dynamic children still arrive as thunks/descriptors and
// are routed through appendChild's existing reactive/defer paths.
const jsxStatic = (tag, props, child)=> {
	const element = SVG_TAGS.has(tag)
		? document.createElementNS('http://www.w3.org/2000/svg', tag)
		: document.createElement(tag)
	for (const key in props){
		// Defensive: skip framework-reserved keys in case the babel transform
		// ever emits them here. `children` shouldn't appear (it's the third
		// arg), and `key` is consumed by the reconciler upstream.
		if (key === 'children' || key === 'key') continue
		applyStaticProp(element, key, props[key])
	}
	if (child !== undefined){
		// Babel emits the third arg as a single value when there is one child
		// and an array when there are several — mirror jsx() / jsxs() shape.
		if (Array.isArray(child)){
			appendChildren(element, child)
		} else {
			appendChild(element, child)
		}
	}
	return element
}
// jsxDEV is the development-mode variant used by automatic JSX transforms; the extra
// debug arguments (isStaticChildren, source, self) are unused at runtime.
const jsxDEV = (tag, props, key) => jsx(tag, props, key)

// ============ DOM template cloning (Solid-style) ============
// Three helpers the babel reactive transform can emit when it identifies a
// statically-shaped JSX subtree. They let the framework skip per-element
// createElement/applyProps/appendChild for the static skeleton and only do
// runtime work for the dynamic holes that babel can't fold into the template.
//
// Emission shape from babel:
//   const _tmpl$ = /*#__PURE__*/ template('<div class="row"><span>item </span></div>')
//   const Row = ({i}) => {
//     const _el = _tmpl$.cloneNode(true)
//     const _span = _el.firstChild
//     insert(_span, () => i, null)   // dynamic text appended at end of span
//     return _el
//   }
// Static props go into the template string itself; dynamic props use setProp;
// dynamic children use insert. There is no separate clone helper — babel emits
// `_tmpl$.cloneNode(true)` directly.

// Parse `html` into a detached template and return the first child of its
// content. Babel emits ONE module-level `template()` call per unique static
// shape, so the parse cost is amortized across every instance — only the
// per-instance `cloneNode(true)` remains hot.
//
// SVG note: an `<svg>` element parsed via innerHTML of an HTMLTemplateElement
// correctly inherits the SVG namespace, but standalone SVG children (`<circle>`
// at the root) do not — pass isSVG=true to wrap-then-unwrap so the namespace
// resolves on every node.
const template = (html, isSVG = false)=> {
	const t = document.createElement('template')
	if (isSVG){
		t.innerHTML = `<svg>${html}</svg>`
		const svgRoot = t.content.firstChild
		// Unwrap so the caller's first cloneNode points at the real root.
		return svgRoot.firstChild ?? svgRoot
	}
	t.innerHTML = html
	return t.content.firstChild
}

// Recursively resolve `value` (which may be a thunk, signal, descriptor, node,
// primitive, or array) into a flat list of Nodes ready to insert. Mirrors what
// node2Element does but flattens arrays in place instead of producing a
// DocumentFragment, since insert() needs direct control over each Node so the
// next reactive run can remove exactly the nodes it inserted.
const resolveChildToNodes = (value, out)=> {
	let v = value
	// Walk through plain thunks (NOT signals/computeds — those resolve to a
	// reactive text node so the framework can update .data in place).
	let steps = 0
	while (typeof v === 'function' && !isReactivePrimitive(v) && steps < MAX_REACTIVE_RESOLVE_STEPS){
		v = v()
		steps += 1
	}
	if (v == null || v === true || v === false) return
	if (v instanceof Node){
		out.push(v)
		return
	}
	if (Array.isArray(v)){
		for (const item of v) resolveChildToNodes(item, out)
		return
	}
	if (isComponentDescriptor(v)){
		out.push(materializeComponentDescriptor(v))
		return
	}
	if (isReactivePrimitive(v)){
		out.push(createReactiveTextNode(v))
		return
	}
	out.push(document.createTextNode(String(v)))
}

// Insert dynamic content into `parent` immediately before `marker` (or at the
// end when marker is null). Static accessors run once; functions/signals wrap
// in a binding effect so the slot updates whenever the source changes.
//
// Single-text-node fast path: when both the previous and next render produce a
// single text/string/number, mutate the existing text node's `.data` instead
// of swapping nodes. This matches Solid's behavior and avoids DOM thrash for
// the common `{count()}` shape.
const insert = (parent, accessor, marker = null)=> {
	if (typeof accessor !== 'function'){
		const nodes = []
		resolveChildToNodes(accessor, nodes)
		for (const n of nodes) parent.insertBefore(n, marker)
		return
	}
	let current = []
	createBindingEffect(()=> {
		const next = accessor()

		// Fast path: single existing text node + scalar next value → in-place data update.
		if (current.length === 1 && current[0].nodeType === 3
			&& (typeof next === 'string' || typeof next === 'number')){
			const str = String(next)
			if (current[0].data !== str) current[0].data = str
			return
		}

		const nodes = []
		resolveChildToNodes(next, nodes)

		// Naive diff: remove current, insert next. Adequate for single-slot
		// inserts; keyed list reconciliation is handled separately by <Loop>.
		for (const n of current){
			if (n.parentNode === parent) parent.removeChild(n)
		}
		for (const n of nodes) parent.insertBefore(n, marker)

		// Mount any owners attached to inserted subtrees (component roots inside
		// the inserted nodes register their owner on the DOM node — runOwnerMounts
		// must fire once they're connected).
		if (parent.isConnected){
			for (const n of nodes) mountOwnedSubtree(n)
		}

		current = nodes
	})
}

// Apply a single prop (static or reactive) to an element. Static values write
// once; function/signal values wrap in a binding effect that re-applies on
// change. Class and style go through the existing helpers so the
// merge/diff semantics stay identical to the JSX path.
const setProp = (element, key, accessor)=> {
	if (key === 'ref'){
		// babel-preset-plastic's template fast path emits identifier refs as
		// `() => refCallback` thunks (0-arity), but passes inline arrow/function
		// expressions through verbatim (>= 1-arity). Distinguish by arity so
		// both shapes work without probing (which would invoke a direct callback
		// with undefined).
		const ref = typeof accessor === 'function' && accessor.length === 0
			? accessor()
			: accessor
		applyRefProp(element, ref)
		return
	}
	// Event handlers (onClick, etc.) — the babel transform emits them as
	// `() => handler` thunks. Resolve once to the handler and attach a single
	// listener that re-reads the current accessor at dispatch time (so a signal
	// returning different handlers stays live without re-attaching).
	if (isEventProp(key)){
		const eventName = key.slice(2).toLowerCase()
		if (!isSupportedEvent(element, eventName)){
			return
		}
		// The babel transform wraps identifier accessors as `() => handler` thunks
		// so a later signal update swapping the handler reference stays live
		// without re-attaching. Arrow/function expressions written inline are
		// passed through verbatim and *are* the handler.
		//
		// Previously we probed `accessor()` once at attach time to decide which
		// shape we had. That broke whenever the handler was undefined / not yet
		// resolved at attach time (e.g. `() => api.onPress` where `api.onPress`
		// is populated later by a signal or async init): probe returned a non-fn,
		// useUnwrap stayed false forever, dispatch then invoked the thunk itself
		// (discarding its return value) and the real handler never fired. The
		// probe also caused observable side effects on attach.
		//
		// Instead: at dispatch time, if the accessor is a thunk (returns a
		// function), unwrap once and call the result; otherwise call the
		// accessor directly. Reactive primitives (signal/computed) follow the
		// same shape — they're functions returning the current value.
		const listener = (...args)=> {
			let handler = accessor
			if (typeof handler === 'function'){
				const unwrapped = handler(...args)
				if (typeof unwrapped === 'function'){
					unwrapped(...args)
				}
			}
		}
		element.addEventListener(eventName, listener)
		if (currentOwner || getCurrentComputation()){
			registerCleanup(()=> {
				element.removeEventListener(eventName, listener)
			})
		}
		return
	}
	if (typeof accessor !== 'function' || isReactivePrimitive(accessor)){
		// Reactive primitives (signal/computed) also go through the effect path
		// so the prop stays in sync — handled in the else branch below.
		if (!isReactive(accessor)){
			applyStaticProp(element, key, accessor)
			return
		}
	}
	let prevStyle
	createBindingEffect(()=> {
		const v = resolveReactiveValue(accessor)
		if (key === 'className' || key === 'class'){
			applyClassProp(element, v)
			return
		}
		if (key === 'style'){
			prevStyle = applyStyleProp(element, v, prevStyle)
			return
		}
		setDomProp(element, JSX_PROP_MAP[key] ?? key, v)
	})
}

// Walk a DOM subtree and dispose every component owner found.
// Handles native-rooted trees where the root node has no OWNER reference.
const disposeOwnedSubtree = (node)=> {
	if (!(node instanceof Node)){ return }
	const owners = []
	const stack = [node]
	while (stack.length){
		const current = stack.pop()
		const owner = current[OWNER]
		if (owner){
			owners.push(owner)
		}
		for (const child of current.childNodes){
			stack.push(child)
		}
	}
	// Dispose top-most owners first (parents before children).
	// disposeOwner handles children recursively, so disposing a parent
	// covers its entire subtree. We only need to fire each unique root.
	const seen = new Set()
	for (const o of owners){
		if (!o.parent || !owners.includes(o.parent)){
			if (!seen.has(o)){
				seen.add(o)
				disposeOwner(o)
			}
		}
	}
}

// Render by appending the normalized root node into the target container.
// Returns a disposer function that cleans up all effects and listeners.
const renderApp = (container, node)=> {
	const appNode = node2Element(node)
	// Capture the actual placed nodes before appendChild — when appNode is a
	// DocumentFragment (e.g. a component returning a thunk routes through
	// createReactiveChildNode), it is drained on insertion and would no longer
	// reference its children, hiding any OWNER attached deeper in the subtree.
	const placedNodes = appNode instanceof DocumentFragment ? [...appNode.childNodes] : [appNode]
	container.appendChild(appNode)
	// Walk the full DOM subtree to find all component owners and fire their
	// onMount callbacks. The root node may be a native element (e.g. <div>)
	// which never gets an OWNER reference, but nested component outputs do.
	placedNodes.forEach(n=> mountOwnedSubtree(n))

	// Return a disposer function
	let disposed = false
	const dispose = ()=> {
		if (disposed){ return }
		disposed = true
		placedNodes.forEach(n=> disposeOwnedSubtree(n))
		placedNodes.forEach((n)=> {
			if (n.parentNode === container){
				container.removeChild(n)
			}
		})
	}

	return dispose
}

export {
	// Public API
	Fragment,
	h,
	jsx,
	jsxDEV,
	jsxs,
	jsxStatic,
	// DOM template cloning helpers (babel reactive transform emits these for
	// statically-shaped JSX subtrees — they let cloned templates skip the
	// per-element jsx()/applyProps machinery)
	template,
	insert,
	setProp,
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
	materializeNode,
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
	// Reactive props proxy
	isMergedProps,
	mergeProps,
}
