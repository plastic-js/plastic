import { describe, expect, it } from 'vitest'
import { createSplitProps, splitProps } from '../src/split-props.js'

describe('splitProps', ()=> {
	it('partitions props into the requested groups and a rest proxy', ()=> {
		const props = { a: 1, b: 2, c: 3, d: 4 }
		const [picked, rest] = splitProps(props, ['a', 'b'])
		expect(picked.a).toBe(1)
		expect(picked.b).toBe(2)
		expect(picked.c).toBeUndefined()
		expect(rest.c).toBe(3)
		expect(rest.d).toBe(4)
		expect(rest.a).toBeUndefined()
	})

	it('supports multiple key groups', ()=> {
		const props = { a: 1, b: 2, c: 3, d: 4 }
		const [g1, g2, rest] = splitProps(props, ['a'], ['b', 'c'])
		expect(g1.a).toBe(1)
		expect(g2.b).toBe(2)
		expect(g2.c).toBe(3)
		expect(rest.d).toBe(4)
		expect(rest.a).toBeUndefined()
		expect(rest.b).toBeUndefined()
	})

	it('reads forward through the source so getters re-run', ()=> {
		let calls = 0
		const props = {
			get value(){
				calls += 1
				return calls
			},
		}
		const [picked] = splitProps(props, ['value'])
		expect(picked.value).toBe(1)
		expect(picked.value).toBe(2)
		expect(picked.value).toBe(3)
	})

	it('reports ownership via `in` operator', ()=> {
		const props = { a: 1, b: 2 }
		const [picked, rest] = splitProps(props, ['a'])
		expect('a' in picked).toBe(true)
		expect('b' in picked).toBe(false)
		expect('a' in rest).toBe(false)
		expect('b' in rest).toBe(true)
	})

	it('exposes ownKeys filtered by predicate', ()=> {
		const props = { a: 1, b: 2, c: 3 }
		const [picked, rest] = splitProps(props, ['a', 'c'])
		expect(Object.keys(picked).sort()).toEqual(['a', 'c'])
		expect(Object.keys(rest)).toEqual(['b'])
	})

	it('returns enumerable property descriptors for present keys', ()=> {
		const props = { a: 1, b: 2 }
		const [picked] = splitProps(props, ['a'])
		const descriptor = Object.getOwnPropertyDescriptor(picked, 'a')
		expect(descriptor.enumerable).toBe(true)
		expect(descriptor.configurable).toBe(true)
		expect(typeof descriptor.get).toBe('function')
		expect(descriptor.get()).toBe(1)
	})

	it('returns undefined descriptor for absent keys', ()=> {
		const props = { a: 1 }
		const [picked] = splitProps(props, ['a'])
		expect(Object.getOwnPropertyDescriptor(picked, 'b')).toBeUndefined()
	})

	it('throws on writes', ()=> {
		const [picked] = splitProps({ a: 1 }, ['a'])
		expect(()=> { picked.a = 2 }).toThrow('read-only')
	})

	it('throws on deletes', ()=> {
		const [picked] = splitProps({ a: 1 }, ['a'])
		expect(()=> { delete picked.a }).toThrow('read-only')
	})

	it('supports spreading into Object.assign', ()=> {
		const props = { a: 1, b: 2, c: 3 }
		const [picked, rest] = splitProps(props, ['a', 'b'])
		expect({ ...picked }).toEqual({ a: 1, b: 2 })
		expect({ ...rest }).toEqual({ c: 3 })
	})

	it('returns only a rest proxy when no key groups are given', ()=> {
		const props = { a: 1, b: 2 }
		const [rest] = splitProps(props)
		expect(rest.a).toBe(1)
		expect(rest.b).toBe(2)
		expect(Object.keys(rest).sort()).toEqual(['a', 'b'])
	})

	it('claims keys across groups so the rest excludes them all', ()=> {
		const props = { a: 1, b: 2, c: 3 }
		const [, , rest] = splitProps(props, ['a'], ['b'])
		expect(Object.keys(rest)).toEqual(['c'])
	})
})

describe('createSplitProps', ()=> {
	it('returns a reusable splitter from rest args', ()=> {
		const splitter = createSplitProps('a', 'b')
		const [picked, rest] = splitter({ a: 1, b: 2, c: 3 })
		expect({ ...picked }).toEqual({ a: 1, b: 2 })
		expect({ ...rest }).toEqual({ c: 3 })
	})

	it('accepts an array as the first argument', ()=> {
		const splitter = createSplitProps(['a', 'b'])
		const [picked, rest] = splitter({ a: 1, b: 2, c: 3 })
		expect({ ...picked }).toEqual({ a: 1, b: 2 })
		expect({ ...rest }).toEqual({ c: 3 })
	})

	it('defaults to empty props', ()=> {
		const splitter = createSplitProps('a')
		const [picked, rest] = splitter()
		expect({ ...picked }).toEqual({})
		expect({ ...rest }).toEqual({})
	})
})
