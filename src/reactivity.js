/**
 * reactivity.js — Reactive system for the Plastic framework.
 *
 * Built on top of the `alien-signals` library, which provides fine-grained
 * signal primitives (`signal`, `computed`, `effect`) suited for primitive values.
 * This module extends that foundation with deep object reactivity.
 *
 * ## Core concepts
 *
 * ### Signals (`createSignal`)
 * A thin public wrapper around `alien-signals`'s `signal()`. Calling
 * `createSignal(x)` on an already-signal value is a no-op — the original
 * signal is returned unchanged.
 *
 * ### Reactive trees (`tree` / `createTree`)
 * `tree(obj)` wraps a plain object (or array) in an ES Proxy that makes every
 * property access and mutation reactive. It is conceptually equivalent to
 * Vue 3's `reactive()`.
 *
 * Key implementation details:
 * - **Per-property signals**: Each accessed property is lazily backed by an
 *   `alien-signals` signal stored in a `signals` map (keyed by property name
 *   or symbol). Reads subscribe the current effect; writes trigger updates.
 * - **Proxy cache**: A `WeakMap` (proxyCache) ensures that wrapping the same
 *   raw object multiple times always returns the same proxy, preventing
 *   duplicate subscriptions.
 * - **`RAW` / `IS_TREE` sentinels**: Two well-known symbols allow consumers to
 *   unwrap to the original object (`toRaw`) and to test whether a value is
 *   already a reactive tree (`isTree`), avoiding double-wrapping.
 * - **Iterate tracking**: A dedicated `ITERATE_KEY` signal is used to track
 *   structural changes (property addition/deletion, array length changes).
 *   Operations like `for…in`, `Object.keys`, and spread trigger this signal so
 *   effects that iterate over an object re-run when its shape changes.
 * - **Non-trackable keys**: Built-in symbols (`Symbol.iterator`, etc.) and a
 *   small set of Vue-compatibility keys are excluded from tracking to avoid
 *   spurious subscriptions.
 * - **Array instrumentations**: Mutating array methods (`push`, `pop`, `shift`,
 *   `unshift`, `splice`) temporarily pause dependency tracking while executing
 *   to prevent the read of `length` inside those methods from creating
 *   unintended subscriptions. Search methods (`includes`, `indexOf`,
 *   `lastIndexOf`) explicitly track all indices and also fall back to comparing
 *   raw (unwrapped) values, supporting reactive proxies as search arguments.
 * - **Nested reactivity**: When `get` returns an object value it is recursively
 *   wrapped with `tree()`, providing deep reactivity on demand.
 * - **Raw value storage**: `set` always unwraps values through `toRaw` before
 *   writing to the underlying target, keeping raw objects free of proxy
 *   references and preventing double-wrapping in the signal store.
 *
 * ### Tracking pause/resume
 * `pauseTracking` / `resumeTracking` manipulate `alien-signals`'s active
 * subscriber stack via `getActiveSub` / `setActiveSub`, temporarily
 * suspending dependency collection for mutation-only code paths.
 *
 * ## Public API
 * Re-exports from `alien-signals`: `computed`, `effect`, `isSignal`, `isComputed`
 * Added by this module: `tree`, `createSignal`, `createTree`, `isTree`, `toRaw`
 */

import {
	computed, effect, endBatch, getActiveSub, isComputed as originalIsComputed, isSignal as originalIsSignal, setActiveSub, signal, startBatch,
} from 'alien-signals'
import { isObject } from './utils.js'

const RAW = Symbol('raw')
const IS_TREE = Symbol('isTree')
const ITERATE_KEY = Symbol('iterate')
const proxyCache = new WeakMap()
const nonTrackableKeys = new Set([
	'__proto__',
	'__v_isRef',
	'__isVue',
])
const builtInSymbols = new Set(Object.getOwnPropertyNames(Symbol)
	.map(key=> Symbol[key])
	.filter(symbol=> typeof symbol === 'symbol'))

const isSignal = value=> {
	if (typeof value === 'function' && originalIsSignal(value)){
		return true
	}
	return false
}

const isComputed = value=> {
	if (typeof value === 'function' && originalIsComputed(value)){
		return true
	}
	return false
}

const isTrackableKey = (key)=> {
	if (typeof key === 'symbol'){
		return !builtInSymbols.has(key)
	}
	if (typeof key !== 'string'){
		return false
	}
	return !nonTrackableKeys.has(key)
}

const isIntegerKey = (key)=> {
	if (typeof key === 'number'){
		return Number.isInteger(key) && key >= 0
	}
	if (typeof key !== 'string' || key === 'NaN' || key[0] === '-'){
		return false
	}
	const parsed = Number(key)
	return Number.isInteger(parsed) && parsed >= 0 && `${parsed}` === key
}

const tree = (obj)=> {
	if (!isObject(obj)){
		return obj
	}
	if (obj[RAW]){
		return obj
	}
	if (proxyCache.has(obj)){
		return proxyCache.get(obj)
	}

	const signals = Object.create(null)
	const hasSignal = key=> Object.hasOwn(signals, key)
	const isArrayTarget = Array.isArray(obj)
	let iterateVersion = 0
	const trackKey = (target, key, receiver)=> {
		if (!isTrackableKey(key)){
			return Reflect.get(target, key, receiver)
		}
		const currentValue = Reflect.get(target, key, receiver)
		if (!hasSignal(key)){
			signals[key] = signal(currentValue)
		}
		return signals[key]()
	}
	const triggerKey = (key, value)=> {
		if (!isTrackableKey(key)){
			if (hasSignal(key)){
				signals[key](value)
			}
			return
		}
		if (!hasSignal(key)){
			signals[key] = signal(value)
			return
		}
		signals[key](value)
	}
	const prevSubStack = []
	const pauseTracking = ()=> {
		prevSubStack.push(getActiveSub())
		setActiveSub(undefined)
	}
	const resumeTracking = ()=> {
		setActiveSub(prevSubStack.pop())
	}
	const trackIterate = ()=> {
		if (!hasSignal(ITERATE_KEY)){
			signals[ITERATE_KEY] = signal(iterateVersion)
		}
		signals[ITERATE_KEY]()
	}
	const triggerIterate = ()=> {
		iterateVersion += 1
		if (!hasSignal(ITERATE_KEY)){
			signals[ITERATE_KEY] = signal(iterateVersion)
			return
		}
		signals[ITERATE_KEY](iterateVersion)
	}

	let arrayInstrumentations = null
	if(isArrayTarget){
		arrayInstrumentations = {
			includes(...args){
				trackKey(obj, 'length')
				for (let i = 0; i < obj.length; i++){
					trackKey(obj, `${i}`)
				}
				const rawResult = Array.prototype.includes.apply(obj, args)
				return rawResult || Array.prototype.includes.apply(obj, args.map(toRaw))
			},
			indexOf(...args){
				trackKey(obj, 'length')
				for (let i = 0; i < obj.length; i++){
					trackKey(obj, `${i}`)
				}
				const rawResult = Array.prototype.indexOf.apply(obj, args)
				if (rawResult !== -1){
					return rawResult
				}
				return Array.prototype.indexOf.apply(obj, args.map(toRaw))
			},
			lastIndexOf(...args){
				trackKey(obj, 'length')
				for (let i = 0; i < obj.length; i++){
					trackKey(obj, `${i}`)
				}
				const rawResult = Array.prototype.lastIndexOf.apply(obj, args)
				if (rawResult !== -1){
					return rawResult
				}
				return Array.prototype.lastIndexOf.apply(obj, args.map(toRaw))
			},
			push(...args){
				pauseTracking()
				try {
					return Array.prototype.push.apply(proxy, args.map(toRaw))
				} finally {
					resumeTracking()
				}
			},
			pop(...args){
				pauseTracking()
				try {
					return Array.prototype.pop.apply(proxy, args)
				} finally {
					resumeTracking()
				}
			},
			shift(...args){
				pauseTracking()
				try {
					return Array.prototype.shift.apply(proxy, args)
				} finally {
					resumeTracking()
				}
			},
			unshift(...args){
				pauseTracking()
				try {
					return Array.prototype.unshift.apply(proxy, args.map(toRaw))
				} finally {
					resumeTracking()
				}
			},
			splice(...args){
				pauseTracking()
				try {
					const normalized = args.map((arg, index)=> index < 2 ? arg : toRaw(arg))
					return Array.prototype.splice.apply(proxy, normalized)
				} finally {
					resumeTracking()
				}
			},
		}
	}

	const proxy = new Proxy(obj, {
		get(target, key, receiver){
			if (key === RAW){
				return target
			}
			if (key === IS_TREE){
				return true
			}
			if (isArrayTarget && typeof key === 'string'){
				if (arrayInstrumentations && Object.hasOwn(arrayInstrumentations, key)){
					return arrayInstrumentations[key]
				}
				if (typeof target[key] === 'function'){
					return Reflect.get(target, key, receiver)
				}
			}
			if (!isTrackableKey(key)){
				return Reflect.get(target, key, receiver)
			}
			const value = trackKey(target, key, receiver)
			if (isObject(value)){
				return tree(value)
			}
			return value
		},
		set(target, key, value, receiver){
			const oldLength = isArrayTarget ? target.length : 0
			const isLengthKey = isArrayTarget && key === 'length'
			const isIndexKey = isArrayTarget && isIntegerKey(key)
			const hadKey = Object.hasOwn(target, key)
			const rawValue = toRaw(value)
			const setOk = Reflect.set(target, key, rawValue, receiver)
			if (!setOk){
				return false
			}
			const nextValue = Reflect.get(target, key, receiver)
			if (!isTrackableKey(key)){
				triggerKey(key, nextValue)
				if (!hadKey){
					triggerIterate()
				}
				return true
			}
			triggerKey(key, nextValue)
			if (isLengthKey){
				const newLength = target.length
				if (newLength < oldLength){
					for (let i = newLength; i < oldLength; i++){
						triggerKey(String(i), undefined)
					}
					triggerIterate()
				}
			}
			if (isIndexKey && Number(key) >= oldLength){
				triggerKey('length', target.length)
			}
			if (!hadKey){
				triggerIterate()
			}
			return true
		},
		has(target, key){
			if (key === IS_TREE){ return true }
			if (key === RAW){ return key in target }
			if (!isTrackableKey(key)){
				return key in target
			}
			trackKey(target, key)
			return key in target
		},
		ownKeys(target){
			trackIterate()
			return Reflect.ownKeys(target)
		},
		deleteProperty(target, key){
			const hadKey = Object.hasOwn(target, key)
			const deleted = Reflect.deleteProperty(target, key)
			if (deleted && hadKey){
				if (hasSignal(key)){
					signals[key](undefined)
				}
				triggerIterate()
			}
			return deleted
		},
	})

	proxyCache.set(obj, proxy)
	return proxy
}

// Component bodies must not subscribe to the reactive context above them. If
// the materializer happens to run inside an outer effect (e.g. a router
// outlet), every signal read by the component would re-trigger that outer
// effect — re-mounting the whole subtree on every unrelated state change.
// Internal binding effects/computations create their own active subscribers,
// so suppressing the outer one here only affects bare signal reads in the
// component body.
const runUntracked = (fn)=> {
	const prevSub = getActiveSub()
	setActiveSub(undefined)
	try {
		return fn()
	} finally {
		setActiveSub(prevSub)
	}
}

const createSignal = (value)=> {
	if (isSignal(value)){
		return value
	}

	if (isComputed(value)){
		console.warn('[reactivity] createSignal: wrapping a computed in a signal is redundant, use the computed directly.')
	}

	return signal(value)
}

const createTree = (value)=> {
	if (!isObject(value)){
		return value
	}

	if (isTree(value)){
		return value
	}

	return tree(value)
}

const isTree = value=> isObject(value) && value[IS_TREE] === true

const toRaw = (value)=> {
	const raw = isObject(value) && value[RAW]
	return raw ? toRaw(raw) : value
}

const batch = (fn)=> {
	startBatch()
	try {
		return fn()
	} finally {
		endBatch()
	}
}

export {
	batch, effect, runUntracked, isComputed, isSignal, isTree, toRaw, createSignal, createTree, computed as createComputed,
}
