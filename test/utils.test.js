import { describe, expect, it } from 'vitest'
import {
	flattenChildren,
	isEventProp,
	isObject,
	normalizeTextNodeValue,
	toClassMap,
	toClassTokens,
} from '../src/utils.js'

describe('isObject', ()=> {
	it('returns true for plain objects', ()=> {
		expect(isObject({})).toBe(true)
		expect(isObject({ a: 1 })).toBe(true)
	})

	it('returns true for arrays', ()=> {
		expect(isObject([])).toBe(true)
	})

	it('returns false for null', ()=> {
		expect(isObject(null)).toBe(false)
	})

	it('returns false for primitives', ()=> {
		expect(isObject(1)).toBe(false)
		expect(isObject('s')).toBe(false)
		expect(isObject(true)).toBe(false)
		expect(isObject(undefined)).toBe(false)
	})
})

describe('flattenChildren', ()=> {
	it('flattens a single-level array', ()=> {
		expect(flattenChildren([1, 2, 3])).toEqual([1, 2, 3])
	})

	it('flattens deeply nested arrays', ()=> {
		expect(flattenChildren([1, [2, [3, [4, [5]]]]])).toEqual([1, 2, 3, 4, 5])
	})

	it('returns an empty array for an empty input', ()=> {
		expect(flattenChildren([])).toEqual([])
	})

	it('preserves non-array primitives at any depth', ()=> {
		expect(flattenChildren(['a', ['b', null, [undefined]]])).toEqual(['a', 'b', null, undefined])
	})
})

describe('isEventProp', ()=> {
	it('returns true for onX-prefixed keys', ()=> {
		expect(isEventProp('onClick')).toBe(true)
		expect(isEventProp('onMouseEnter')).toBe(true)
		expect(isEventProp('onA')).toBe(true)
	})

	it('returns false for keys without a letter after on', ()=> {
		expect(isEventProp('on')).toBe(false)
		expect(isEventProp('on123')).toBe(false)
		expect(isEventProp('only')).toBe(true) // matches /^on[A-Za-z]/ — documents current behavior
	})

	it('returns false for non-on keys', ()=> {
		expect(isEventProp('click')).toBe(false)
		expect(isEventProp('')).toBe(false)
	})
})

describe('normalizeTextNodeValue', ()=> {
	it('returns empty string for null/undefined', ()=> {
		expect(normalizeTextNodeValue(null)).toBe('')
		expect(normalizeTextNodeValue(undefined)).toBe('')
	})

	it('coerces numbers and booleans to strings', ()=> {
		expect(normalizeTextNodeValue(0)).toBe('0')
		expect(normalizeTextNodeValue(42)).toBe('42')
		expect(normalizeTextNodeValue(false)).toBe('false')
		expect(normalizeTextNodeValue(true)).toBe('true')
	})

	it('passes strings through', ()=> {
		expect(normalizeTextNodeValue('hello')).toBe('hello')
		expect(normalizeTextNodeValue('')).toBe('')
	})
})

describe('toClassTokens', ()=> {
	it('returns an empty Set for non-strings', ()=> {
		expect(toClassTokens(null).size).toBe(0)
		expect(toClassTokens(undefined).size).toBe(0)
		expect(toClassTokens(123).size).toBe(0)
		expect(toClassTokens({}).size).toBe(0)
	})

	it('splits on whitespace and dedupes', ()=> {
		const tokens = toClassTokens('a b  c\t\nd a')
		expect([...tokens]).toEqual(['a', 'b', 'c', 'd'])
	})

	it('drops empty tokens', ()=> {
		expect([...toClassTokens('  ')]).toEqual([])
	})
})

describe('toClassMap', ()=> {
	it('returns an empty Map for falsy input', ()=> {
		expect(toClassMap(null).size).toBe(0)
		expect(toClassMap(undefined).size).toBe(0)
		expect(toClassMap('').size).toBe(0)
		expect(toClassMap(0).size).toBe(0)
	})

	it('maps each class token to true', ()=> {
		const map = toClassMap('a b c')
		expect(map.get('a')).toBe(true)
		expect(map.get('b')).toBe(true)
		expect(map.get('c')).toBe(true)
		expect(map.size).toBe(3)
	})

	it('dedupes repeated tokens', ()=> {
		const map = toClassMap('a a b')
		expect(map.size).toBe(2)
	})
})
