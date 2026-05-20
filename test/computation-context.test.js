import { afterEach, describe, expect, it } from 'vitest'
import {
	getCurrentComputation,
	setCurrentComputation,
} from '../src/computation-context.js'

describe('computation-context', ()=> {
	afterEach(()=> {
		setCurrentComputation(null)
	})

	it('starts with no current computation', ()=> {
		expect(getCurrentComputation()).toBe(null)
	})

	it('returns the value set via setCurrentComputation', ()=> {
		const fakeComputation = { id: 1 }
		setCurrentComputation(fakeComputation)
		expect(getCurrentComputation()).toBe(fakeComputation)
	})

	it('can be reset to null', ()=> {
		setCurrentComputation({ id: 1 })
		setCurrentComputation(null)
		expect(getCurrentComputation()).toBe(null)
	})

	it('supports nested save/restore patterns', ()=> {
		const outer = { name: 'outer' }
		const inner = { name: 'inner' }

		setCurrentComputation(outer)
		const saved = getCurrentComputation()
		setCurrentComputation(inner)
		expect(getCurrentComputation()).toBe(inner)
		setCurrentComputation(saved)
		expect(getCurrentComputation()).toBe(outer)
	})

	it('shares a single module-level slot across reads', ()=> {
		const value = { v: 42 }
		setCurrentComputation(value)
		expect(getCurrentComputation()).toBe(getCurrentComputation())
		expect(getCurrentComputation()).toBe(value)
	})
})
