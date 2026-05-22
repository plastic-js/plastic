import {
	describe, expect, it, vi,
} from 'vitest'
import { createAsync } from '../src/async.js'

const flush = ()=> new Promise(resolve=> setTimeout(resolve, 0))

describe('createAsync', ()=> {
	it('accepts a Promise factory and resolves data', async ()=> {
		const async = createAsync(()=> Promise.resolve(42))

		expect(async.isLoading()).toBe(true)
		expect(async.data()).toBe(undefined)
		expect(async.error()).toBe(null)

		await flush()

		expect(async.isLoading()).toBe(false)
		expect(async.data()).toBe(42)
		expect(async.error()).toBe(null)
	})

	it('accepts a Promise directly', async ()=> {
		const async = createAsync(Promise.resolve('hello'))
		await flush()
		expect(async.data()).toBe('hello')
	})

	it('throws synchronously for non-Promise/non-function input', ()=> {
		expect(()=> createAsync(123)).toThrow(TypeError)
		expect(()=> createAsync(null)).toThrow(TypeError)
	})

	it('captures rejection in error and clears loading', async ()=> {
		const failure = new Error('boom')
		const async = createAsync(()=> Promise.reject(failure))

		await flush()

		expect(async.isLoading()).toBe(false)
		expect(async.error()).toBe(failure)
		expect(async.data()).toBe(undefined)
	})

	it('captures runner sync throw via rejected run()', async ()=> {
		const failure = new Error('sync')
		const runner = vi.fn(()=> { throw failure })
		const async = createAsync(runner)

		await flush()

		expect(async.error()).toBe(failure)
		expect(async.isLoading()).toBe(false)
	})

	it('rejects when runner returns a non-Promise', async ()=> {
		const async = createAsync(()=> 'not a promise')
		await flush()
		expect(async.error()).toBeInstanceOf(TypeError)
		expect(async.isLoading()).toBe(false)
	})

	it('run() can be invoked manually with args', async ()=> {
		const runner = vi.fn(x=> Promise.resolve(x * 2))
		const async = createAsync(runner)
		await flush()
		expect(async.data()).toBe(NaN) // initial auto-run passed no args

		await async.run(5)
		expect(async.data()).toBe(10)
		expect(runner).toHaveBeenCalledTimes(2)
	})

	it('ignores stale results when a newer run is in flight', async ()=> {
		let resolveSlow
		const slow = new Promise(r=> { resolveSlow = r })
		let call = 0
		const runner = ()=> {
			call += 1
			return call === 1 ? slow : Promise.resolve('fast')
		}
		const async = createAsync(runner)

		const fastRun = async.run()
		await fastRun
		expect(async.data()).toBe('fast')
		expect(async.isLoading()).toBe(false)

		resolveSlow('stale')
		await flush()
		expect(async.data()).toBe('fast')
	})

	it('cancel() resets loading and prevents stale write', async ()=> {
		let resolveIt
		const pending = new Promise(r=> { resolveIt = r })
		const async = createAsync(()=> pending)

		expect(async.isLoading()).toBe(true)
		async.cancel()
		expect(async.isLoading()).toBe(false)

		resolveIt('late')
		await flush()
		expect(async.data()).toBe(undefined)
	})

	it('cancel() is a no-op when not loading', async ()=> {
		const async = createAsync(()=> Promise.resolve(1))
		await flush()
		expect(async.isLoading()).toBe(false)
		async.cancel()
		expect(async.isLoading()).toBe(false)
		expect(async.data()).toBe(1)
	})
})
