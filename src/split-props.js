// Solid-style splitProps. Partitions a props object into one proxy per key
// group plus a trailing "rest" proxy. Reads forward through the original
// `props[key]`, so any getter defined on the source re-runs at the consumer's
// read site and continues to track signals.

const readOnlyTrap = ()=> {
	throw new Error('splitProps result is read-only')
}

const createSplitProxy = (source, predicate)=> new Proxy({}, {
	get: (_, key)=> predicate(key) ? source[key] : undefined,
	has: (_, key)=> predicate(key) && key in source,
	ownKeys: ()=> Reflect.ownKeys(source).filter(predicate),
	getOwnPropertyDescriptor: (_, key)=> {
		if (!predicate(key) || !(key in source)){
			return undefined
		}
		return {
			enumerable: true,
			configurable: true,
			get: ()=> source[key],
		}
	},
	set: readOnlyTrap,
	deleteProperty: readOnlyTrap,
})

export const splitProps = (props, ...keyGroups)=> {
	const claimed = new Set()
	const groups = keyGroups.map((keys)=> {
		const keySet = new Set(keys)
		keys.forEach(key=> claimed.add(key))
		return createSplitProxy(props, key=> keySet.has(key))
	})
	const rest = createSplitProxy(props, key=> !claimed.has(key))
	return [...groups, rest]
}

export const createSplitProps = (...keys)=> {
	const normalizedKeys = Array.isArray(keys[0]) ? keys[0] : keys
	return (props = {})=> splitProps(props, normalizedKeys)
}
