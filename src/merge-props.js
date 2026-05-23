// Solid-style props proxy. Returns a Proxy that lazily resolves each key from
// the supplied sources, so getter-defined properties remain reactive: the
// outer consumer reads `proxy.foo` inside a binding effect, which invokes the
// getter, which in turn subscribes to any signals it reads.
//
// Semantics:
//   - Sources are scanned in argument order. For most keys, the last source
//     that has the key wins (matches Solid).
//   - `class` / `className`: both aliases participate in one merged class
//     stream. Reads of either key see the same concatenated result.
//   - `style`: object values shallow-merge across sources; string values
//     concatenate with `; `; mixing prefers the latest resolved value.
//   - Thunk-valued `class`, `className`, and `style` remain lazy: reads of
//     those keys return a merged accessor thunk that resolves all sources at
//     call time, preserving runtime dependency tracking.
//   - `ref` and `onXxx` event handlers: last source wins (matches Solid).
//   - The proxy is read-only: writes throw.

import { isPlainObject } from './utils.js'

const CLASS_KEYS = ['class', 'className']
const STYLE_KEYS = ['style']
const MAX_MERGE_VALUE_RESOLVE_STEPS = 16

const normalizeClassValue = (value)=> {
	if (value == null || value === false || value === ''){
		return undefined
	}
	if (typeof value !== 'string'){
		return undefined
	}
	return value
}

const isClassKey = key=> key === 'class' || key === 'className'

const resolveThunkValue = (value)=> {
	let resolved = value
	let steps = 0
	while (typeof resolved === 'function' && steps < MAX_MERGE_VALUE_RESOLVE_STEPS){
		resolved = resolved()
		steps += 1
	}

	return resolved
}

// Concatenate only string-valued class sources. If any source carries a
// function or signal (a reactive accessor for the class string), it would not
// be safe to coerce via String(...) — that would emit the function's source
// code. Fall back to last-wins so the consumer's `resolveReactiveValue` can
// unwrap it normally.
const mergeClassValues = (values)=> {
	const hasNonString = values.some(value=> value != null && typeof value !== 'string' && value !== false)
	if (hasNonString){
		return values[values.length - 1]
	}
	const parts = values.map(normalizeClassValue).filter(Boolean)
	return parts.length ? parts.join(' ') : undefined
}

const mergeStyleValues = (values)=> {
	let result
	for (const value of values){
		if (value == null){
			continue
		}
		if (isPlainObject(result) && isPlainObject(value)){
			result = { ...result, ...value }
		} else if (typeof result === 'string' && typeof value === 'string'){
			result = `${result}; ${value}`
		} else {
			result = value
		}
	}
	return result
}


// Sources can be either plain objects or zero-arg functions ("thunks") that
// the Babel plugin emits for dynamic spread sources like `{...api()}`. The
// thunk is invoked on every access so signal reads inside `api()` are tracked
// by whatever effect is currently consuming the proxy.
const resolveSource = source=> typeof source === 'function' ? source() : source

const collectPresentKeys = (source, keys)=> {
	const matches = []
	const seen = new Set()
	for (const key of Reflect.ownKeys(source)){
		if (typeof key !== 'string' || !keys.includes(key) || seen.has(key)){
			continue
		}
		seen.add(key)
		matches.push(key)
	}

	for (const key of keys){
		if (seen.has(key) || !(key in source)){
			continue
		}
		matches.push(key)
	}

	return matches
}

// Collect each source's value for a key family in source order, invoking any
// getter (which is where signal-tracking happens for reactive props).
const collectValues = (sources, keys)=> {
	const values = []
	for (const source of sources){
		const resolved = resolveSource(source)
		if (resolved == null){
			continue
		}
		for (const key of collectPresentKeys(resolved, keys)){
			values.push(resolved[key])
		}
	}
	return values
}

const getKeyFamily = (key)=> {
	if (isClassKey(key)){
		return CLASS_KEYS
	}
	if (key === 'style'){
		return STYLE_KEYS
	}
	return [key]
}

const resolveKey = (sources, key)=> {
	const values = collectValues(sources, getKeyFamily(key))
	if (values.length === 0){
		return undefined
	}

	if (key === 'class' || key === 'className'){
		if (values.some(value=> typeof value === 'function')){
			// Keep merged class values lazy so runtime consumers can resolve the
			// accessor inside their own tracking scope instead of subscribing here.
			return ()=> mergeClassValues(values.map(resolveThunkValue))
		}
		return mergeClassValues(values)
	}

	if (key === 'style'){
		if (values.some(value=> typeof value === 'function')){
			// Style follows the same rule as class: preserve thunk semantics so
			// updates track at the eventual DOM-binding read site.
			return ()=> mergeStyleValues(values.map(resolveThunkValue))
		}
		return mergeStyleValues(values)
	}

	return values[values.length - 1]
}

const hasKey = (sources, key)=> {
	const keys = getKeyFamily(key)
	for (const source of sources){
		const resolved = resolveSource(source)
		if (resolved == null){
			continue
		}
		if (keys.some(candidate=> candidate in resolved)){
			return true
		}
	}
	return false
}

const getCanonicalClassKey = (sources)=> {
	let canonicalKey
	for (const source of sources){
		const resolved = resolveSource(source)
		if (resolved == null){
			continue
		}
		for (const key of collectPresentKeys(resolved, CLASS_KEYS)){
			canonicalKey = key
		}
	}
	return canonicalKey
}

const collectKeys = (sources)=> {
	const seen = new Set()
	const keys = []
	let hasClassAlias = false
	for (const source of sources){
		const resolved = resolveSource(source)
		if (resolved == null){
			continue
		}
		for (const key of Reflect.ownKeys(resolved)){
			if (isClassKey(key)){
				hasClassAlias = true
				continue
			}
			if (!seen.has(key)){
				seen.add(key)
				keys.push(key)
			}
		}
	}
	if (hasClassAlias){
		// Expose one canonical class key during enumeration so reflection APIs
		// (`Object.assign`, `Object.entries`) don't duplicate `class`/`className`.
		keys.push(getCanonicalClassKey(sources) ?? 'class')
	}
	return keys
}

const readOnlyTrap = ()=> {
	throw new Error('mergeProps result is read-only')
}

const IS_MERGED_PROPS = Symbol('mergeProps')

export const mergeProps = (...sources)=> {
	// Fast path: a single plain-object source is structurally equivalent to the
	// object itself for prop access (no class/className aliasing across sources,
	// no style merging, no spread thunks). Babel reactive transform wraps every
	// JSX in `mergeProps({...})` even with no spreads, so this short-circuit
	// eliminates one Proxy allocation per element on the typical render path.
	if (sources.length === 1 && sources[0] != null && typeof sources[0] === 'object' && isPlainObject(sources[0])){
		return sources[0]
	}

	return new Proxy({}, {
		get: (_, key)=> {
			if (key === IS_MERGED_PROPS) return true
			return resolveKey(sources, key)
		},
		has: (_, key)=> hasKey(sources, key),
		ownKeys: ()=> collectKeys(sources),
		getOwnPropertyDescriptor: (_, key)=> {
			if (!hasKey(sources, key)){
				return undefined
			}
			return {
				enumerable: true,
				configurable: true,
				get: ()=> resolveKey(sources, key),
			}
		},
		set: readOnlyTrap,
		deleteProperty: readOnlyTrap,
	})
}

export const isMergedProps = (value)=> value != null && typeof value === 'object' && value[IS_MERGED_PROPS] === true
