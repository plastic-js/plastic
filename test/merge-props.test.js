import { describe, expect, it } from 'vitest'
import { isMergedProps, mergeProps } from '../src/merge-props.js'

describe('mergeProps basics', ()=> {
	it('last source wins for ordinary keys', ()=> {
		const merged = mergeProps({ a: 1, b: 2 }, { b: 20, c: 3 })
		expect(merged.a).toBe(1)
		expect(merged.b).toBe(20)
		expect(merged.c).toBe(3)
	})

	it('skips null/undefined sources', ()=> {
		const merged = mergeProps(null, { a: 1 }, undefined, { b: 2 })
		expect(merged.a).toBe(1)
		expect(merged.b).toBe(2)
	})

	it('returns undefined for missing keys', ()=> {
		const merged = mergeProps({ a: 1 })
		expect(merged.missing).toBeUndefined()
	})

	it('invokes thunk sources at access time', ()=> {
		let count = 0
		const merged = mergeProps(()=> {
			count += 1
			return { value: count }
		})
		expect(merged.value).toBe(1)
		expect(merged.value).toBe(2)
	})

	it('preserves getter reactivity by reading through on each access', ()=> {
		let v = 1
		const source = {
			get value(){ return v },
		}
		const merged = mergeProps(source)
		expect(merged.value).toBe(1)
		v = 99
		expect(merged.value).toBe(99)
	})
})

describe('mergeProps class/className aliasing', ()=> {
	it('concatenates string class values across sources', ()=> {
		const merged = mergeProps({ class: 'a' }, { class: 'b' })
		expect(merged.class).toBe('a b')
	})

	it('merges class and className together', ()=> {
		const merged = mergeProps({ class: 'a' }, { className: 'b' })
		// both aliases see the merged value
		expect(merged.class).toBe('a b')
		expect(merged.className).toBe('a b')
	})

	it('ignores empty / nullish class values', ()=> {
		const merged = mergeProps({ class: 'a' }, { class: null }, { class: '' }, { class: 'b' })
		expect(merged.class).toBe('a b')
	})

	it('returns a thunk when any class value is a function', ()=> {
		const merged = mergeProps({ class: 'a' }, { class: ()=> 'dynamic' })
		const value = merged.class
		expect(typeof value).toBe('function')
		expect(value()).toBe('a dynamic')
	})

	it('exposes only one canonical class key in ownKeys', ()=> {
		const merged = mergeProps({ class: 'a' }, { className: 'b' })
		const keys = Object.keys(merged)
		const classKeys = keys.filter(k=> k === 'class' || k === 'className')
		expect(classKeys.length).toBe(1)
	})
})

describe('mergeProps style merging', ()=> {
	it('shallow-merges object styles', ()=> {
		const merged = mergeProps(
			{ style: { color: 'red', fontSize: 10 } },
			{ style: { color: 'blue', margin: 0 } },
		)
		expect(merged.style).toEqual({ color: 'blue', fontSize: 10, margin: 0 })
	})

	it('concatenates string styles with "; "', ()=> {
		const merged = mergeProps({ style: 'color: red' }, { style: 'margin: 0' })
		expect(merged.style).toBe('color: red; margin: 0')
	})

	it('prefers the latest value when mixing strings and objects', ()=> {
		const merged = mergeProps({ style: 'color: red' }, { style: { margin: 0 } })
		expect(merged.style).toEqual({ margin: 0 })
	})

	it('returns a thunk when any style value is a function', ()=> {
		const merged = mergeProps(
			{ style: { color: 'red' } },
			{ style: ()=> ({ margin: 0 }) },
		)
		const value = merged.style
		expect(typeof value).toBe('function')
		expect(value()).toEqual({ color: 'red', margin: 0 })
	})

	it('skips null/undefined style values', ()=> {
		const merged = mergeProps({ style: null }, { style: { color: 'red' } }, { style: undefined })
		expect(merged.style).toEqual({ color: 'red' })
	})
})

describe('mergeProps reflection', ()=> {
	it('has correct `in` behavior', ()=> {
		const merged = mergeProps({ a: 1 }, { b: 2 })
		expect('a' in merged).toBe(true)
		expect('b' in merged).toBe(true)
		expect('c' in merged).toBe(false)
	})

	it('enumerates union of keys', ()=> {
		const merged = mergeProps({ a: 1 }, { b: 2 }, { c: 3 })
		expect(Object.keys(merged).sort()).toEqual(['a', 'b', 'c'])
	})

	it('returns property descriptors backed by a getter', ()=> {
		const merged = mergeProps({ a: 1 }, { a: 2 })
		const descriptor = Object.getOwnPropertyDescriptor(merged, 'a')
		expect(descriptor.enumerable).toBe(true)
		expect(descriptor.configurable).toBe(true)
		expect(descriptor.get()).toBe(2)
	})

	it('returns undefined descriptor for missing keys', ()=> {
		expect(Object.getOwnPropertyDescriptor(mergeProps({ a: 1 }), 'b')).toBeUndefined()
	})

	it('spreads correctly', ()=> {
		const merged = mergeProps({ a: 1, b: 2 }, { b: 3 })
		expect({ ...merged }).toEqual({ a: 1, b: 3 })
	})
})

describe('mergeProps is read-only', ()=> {
	// Multi-source proxies enforce read-only via the Proxy traps. The single-source
	// fast path returns the source object as-is for perf, so the read-only guarantee
	// only applies when there are 2+ sources.
	it('throws on writes', ()=> {
		const merged = mergeProps({ a: 1 }, { b: 2 })
		expect(()=> { merged.a = 2 }).toThrow('read-only')
	})

	it('throws on deletes', ()=> {
		const merged = mergeProps({ a: 1 }, { b: 2 })
		expect(()=> { delete merged.a }).toThrow('read-only')
	})
})

describe('isMergedProps', ()=> {
	it('returns true for multi-source mergeProps results', ()=> {
		// Single-source mergeProps short-circuits to the source object for perf;
		// the IS_MERGED_PROPS marker is only present on the multi-source proxy.
		expect(isMergedProps(mergeProps({ a: 1 }, { b: 2 }))).toBe(true)
	})

	it('returns false for plain objects', ()=> {
		expect(isMergedProps({ a: 1 })).toBe(false)
	})

	it('returns false for null/undefined/primitives', ()=> {
		expect(isMergedProps(null)).toBe(false)
		expect(isMergedProps(undefined)).toBe(false)
		expect(isMergedProps(1)).toBe(false)
		expect(isMergedProps('x')).toBe(false)
	})

	it('returns false for arrays', ()=> {
		// arrays don't carry the IS_MERGED_PROPS symbol
		expect(isMergedProps([])).toBe(false)
	})
})
