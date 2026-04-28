let currentComputation = null

const getCurrentComputation = ()=> currentComputation
const setCurrentComputation = (value)=> {
	currentComputation = value
}

export {
	getCurrentComputation,
	setCurrentComputation,
}
