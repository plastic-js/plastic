import { createSignal } from './src/reactivity.js'

const normalizeService = (service)=> {
	if (typeof service === 'function'){
		return service
	}

	if (service instanceof Promise){
		return ()=> service
	}

	throw new TypeError('createAsync expects a Promise or a function returning a Promise')
}

const createAsync = (service)=> {
	const runner = normalizeService(service)
	const isLoading = createSignal(false)
	const data = createSignal(undefined)
	const error = createSignal(null)
	let latestRunId = 0

	const run = (...args)=> {
		const runId = ++latestRunId
		isLoading(true)
		error(null)

		let promise
		try {
			promise = runner(...args)
		} catch(err){
			error(err)
			isLoading(false)
			return Promise.reject(err)
		}

		if (!(promise instanceof Promise)){
			const typeError = new TypeError('createAsync runner must return a Promise')
			error(typeError)
			isLoading(false)
			return Promise.reject(typeError)
		}

		return promise
			.then((value)=> {
				if (runId !== latestRunId){
					return value
				}

				data(value)
				error(null)
				return value
			})
			.catch((err)=> {
				if (runId === latestRunId){
					error(err)
				}
				throw err
			})
			.finally(()=> {
				if (runId === latestRunId){
					isLoading(false)
				}
			})
	}

	const cancel = ()=> {
		if (!isLoading()){
			return
		}
		latestRunId++
		isLoading(false)
	}

	// Default behavior: trigger once on creation for immediate data fetch.
	run().catch(()=> {})

	return {
		isLoading,
		data,
		error,
		run,
		cancel,
	}
}

export {
	createAsync,
}
