// Shared module-level state for the currently running computation.
// Extracted into its own module so the two consumers can share the same
// reference without forming a circular import between them:
//   - the computation runner writes it before/after executing a tracked fn
//   - the signal/state layer reads it when a signal is invoked (e.g.
//     `signal()`) to register the running computation as a dependency
let currentComputation = null

const getCurrentComputation = ()=> currentComputation
const setCurrentComputation = (value)=> {
	currentComputation = value
}

export {
	getCurrentComputation,
	setCurrentComputation,
}
