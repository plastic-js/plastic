import {
	describe, expect, it,
} from 'vitest'
import {
	createSignal, createTree, effect,
} from '../src/reactivity.js'

describe('createTree key tracking guard', ()=> {
	it('does not track __proto__ access', ()=> {
		const state = createTree({
			count: 1,
		})
		let runs = 0

		effect(()=> {
			runs += 1
			void state.__proto__
		})

		state.__proto__ = {
			patched: true,
		}

		expect(runs).toBe(1)
	})

	it('does not track built-in symbol accesses in get trap', ()=> {
		const state = createTree({
			count: 1,
		})
		let primitiveRuns = 0
		let iteratorRuns = 0

		effect(()=> {
			primitiveRuns += 1
			void state[Symbol.toPrimitive]
		})

		effect(()=> {
			iteratorRuns += 1
			void state[Symbol.iterator]
		})

		state[Symbol.toPrimitive] = ()=> 1
		state[Symbol.iterator] = function *(){
			yield 1
		}

		expect(primitiveRuns).toBe(1)
		expect(iteratorRuns).toBe(1)
	})

	it('does not track built-in symbol accesses in has trap', ()=> {
		const state = createTree({})
		let runs = 0

		effect(()=> {
			runs += 1
			void (Symbol.toStringTag in state)
		})

		state[Symbol.toStringTag] = 'ReactiveState'

		expect(runs).toBe(1)
	})

	it('still tracks normal string keys', ()=> {
		const state = createTree({
			count: 1,
		})
		let runs = 0

		effect(()=> {
			runs += 1
			void state.count
		})

		state.count = 2

		expect(runs).toBe(2)
	})

	it('tracks object key iteration via ownKeys trap', ()=> {
		const state = createTree({
			a: 1,
		})
		let keyRuns = 0
		let entryRuns = 0
		let forInRuns = 0

		effect(()=> {
			keyRuns += 1
			Object.keys(state)
		})

		effect(()=> {
			entryRuns += 1
			Object.entries(state)
		})

		effect(()=> {
			forInRuns += 1
			for (const key in state){
				void key
			}
		})

		state.a = 2
		expect(keyRuns).toBe(1)
		expect(entryRuns).toBe(2)
		expect(forInRuns).toBe(1)

		state.b = 2
		expect(keyRuns).toBe(2)
		expect(entryRuns).toBe(3)
		expect(forInRuns).toBe(2)

		delete state.b
		expect(keyRuns).toBe(3)
		expect(entryRuns).toBe(5)
		expect(forInRuns).toBe(3)
	})

	it('still notifies value subscribers after a key is deleted and re-added', ()=> {
		const state = createTree({ x: 10 })
		const log = []

		effect(()=> log.push(state.x))
		expect(log).toEqual([10])

		delete state.x
		expect(log).toEqual([10, undefined])

		state.x = 5
		expect(log).toEqual([10, undefined, 5])

		state.x = 7
		expect(log).toEqual([10, undefined, 5, 7])
	})
})

describe('createTree array reactivity', ()=> {
	it('push triggers length and iteration without infinite loop', ()=> {
		const arr = createTree([1, 2, 3])
		let lengthRuns = 0
		let iterRuns = 0

		effect(()=> {
			lengthRuns += 1
			void arr.length
		})

		effect(()=> {
			iterRuns += 1
			for (const _ of arr){ void _ }
		})

		arr.push(4)
		expect(arr.length).toBe(4)
		expect(arr[3]).toBe(4)
		expect(lengthRuns).toBe(2)
		expect(iterRuns).toBe(2)
	})

	it('push inside an effect does not re-run that effect', ()=> {
		const arr = createTree([1])
		let outerRuns = 0

		effect(()=> {
			outerRuns += 1
			arr.push(outerRuns + 1)
		})

		expect(outerRuns).toBe(1)
		expect(arr.length).toBe(2)
	})

	it('pop, shift, unshift, splice work without self-triggering', ()=> {
		const arr = createTree([1, 2, 3, 4])
		let runs = 0

		effect(()=> {
			runs += 1
			if (arr.length > 1){
				arr.pop()
			}
		})

		expect(runs).toBe(1)
		expect(arr.length).toBe(3)

		const arr2 = createTree([1, 2, 3])
		arr2.shift()
		expect(arr2).toEqual([2, 3])
		arr2.unshift(0)
		expect(arr2).toEqual([0, 2, 3])
		arr2.splice(1, 1, 9, 9)
		expect(arr2).toEqual([0, 9, 9, 3])
	})

	it('includes / indexOf / lastIndexOf work with reactive proxies', ()=> {
		const item = { id: 1 }
		const arr = createTree([item, { id: 2 }, item])

		// Searching with the original raw object should still find it
		// even though indexed access returns a proxy.
		expect(arr.includes(item)).toBe(true)
		expect(arr.indexOf(item)).toBe(0)
		expect(arr.lastIndexOf(item)).toBe(2)

		// Searching with the proxied version should also work.
		const proxied = arr[0]
		expect(arr.includes(proxied)).toBe(true)
		expect(arr.indexOf(proxied)).toBe(0)
	})

	it('search methods track index changes', ()=> {
		const arr = createTree([1, 2, 3])
		let runs = 0
		let last = false

		effect(()=> {
			runs += 1
			last = arr.includes(99)
		})

		expect(runs).toBe(1)
		expect(last).toBe(false)

		arr[1] = 99
		expect(runs).toBe(2)
		expect(last).toBe(true)
	})

	it('setting an index past the end triggers length', ()=> {
		const arr = createTree([1, 2])
		let lengthRuns = 0

		effect(()=> {
			lengthRuns += 1
			void arr.length
		})

		arr[5] = 99
		expect(arr.length).toBe(6)
		expect(lengthRuns).toBe(2)
	})

	it('shrinking length triggers effects on dropped indices', ()=> {
		const arr = createTree([1, 2, 3, 4, 5])
		const log = []

		effect(()=> log.push(arr[3]))
		expect(log).toEqual([4])

		arr.length = 2
		expect(log).toEqual([4, undefined])
	})

	it('for...of and for-i loops both react to push', ()=> {
		const arr = createTree([1, 2])
		const ofLog = []
		const idxLog = []

		effect(()=> {
			const items = []
			for (const v of arr){ items.push(v) }
			ofLog.push(items.join(','))
		})

		effect(()=> {
			const items = []
			for (const element of arr){ items.push(element) }
			idxLog.push(items.join(','))
		})

		arr.push(3)
		expect(ofLog).toEqual(['1,2', '1,2,3'])
		expect(idxLog).toEqual(['1,2', '1,2,3'])
	})
})

describe('createSignal and createTree wrappers', ()=> {
	it('createSignal keeps createTree proxy reference', ()=> {
		const source = createTree({
			count: 1,
		})
		const holder = createSignal(source)

		expect(holder()).toBe(source)
		holder().count += 1
		expect(source.count).toBe(2)
	})

	it('createTree keeps nested createTree proxy identity', ()=> {
		const child = createTree({
			value: 1,
		})
		const parent = createTree({
			child,
		})

		expect(parent.child).toBe(child)
	})
})
