const isObject = (value)=> {
	return value !== null && typeof value === 'object'
}

const flattenChildren = children=> children.flat(Infinity)

const isEventProp = key=> (/^on[A-Za-z]/).test(key)

const normalizeTextNodeValue = (value)=> {
	if (value == null){
		return ''
	}

	return String(value)
}

const toClassTokens = (value)=> {
	if (typeof value !== 'string'){
		return new Set()
	}

	return new Set(value
		.split(/\s+/)
		.filter(Boolean))
}

const toClassMap = (value)=> {
	// null
	if(!value){
		return new Map()
	}
	// string
	const tokens = toClassTokens(value)
	const map = new Map()
	tokens.forEach((token)=> {
		map.set(token, true)
	})
	return map
}

export {
	isObject,
	flattenChildren,
	isEventProp,
	normalizeTextNodeValue,
	toClassTokens,
	toClassMap,
}
