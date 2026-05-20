// Shared utilities for all framework harnesses.
// Each framework's main.* imports this and wires up window.__bench.

export const makeItems = (n)=> {
	const items = new Array(n)
	for (let i = 0; i < n; i += 1){
		items[i] = { id: i, label: `item ${i}` }
	}
	return items
}

// LCG so shuffles are reproducible across frameworks.
const shuffle = (arr, seed = 1)=> {
	const a = arr.slice()
	let s = seed
	for (let i = a.length - 1; i > 0; i -= 1){
		s = (s * 1103515245 + 12345) & 0x7fffffff
		const j = s % (i + 1)
		;[a[i], a[j]] = [a[j], a[i]]
	}
	return a
}

// Apply a diff op to an array; identical logic across frameworks for fairness.
export const applyDiff = (cur, op)=> {
	if (op === 'reverse'){
		return cur.slice().reverse()
	}
	if (op === 'shuffle'){
		return shuffle(cur)
	}
	if (op === 'insert'){
		const mid = cur.length >> 1
		const extra = []
		for (let i = 0; i < 100; i += 1){
			extra.push({ id: cur.length + i, label: `new ${i}` })
		}
		return [...cur.slice(0, mid), ...extra, ...cur.slice(mid)]
	}
	if (op === 'remove'){
		return cur.filter((_, i)=> i % 2 === 0)
	}
	if (op === 'swap'){
		const next = cur.slice()
		;[next[0], next[next.length - 1]] = [next[next.length - 1], next[0]]
		return next
	}
	throw new Error(`unknown op ${op}`)
}

// Force layout flush so we capture full render cost, not just JS work.
export const flush = async ()=> {
	document.body.getBoundingClientRect()
	await new Promise(r=> requestAnimationFrame(r))
	await new Promise(r=> requestAnimationFrame(r))
}

export const time = async (fn)=> {
	const t0 = performance.now()
	await fn()
	await flush()
	return performance.now() - t0
}

// Hand each app a fresh container so previous runs don't leak.
export const makeHost = ()=> {
	const old = document.getElementById('app')
	if (old){ old.remove() }
	const el = document.createElement('div')
	el.id = 'app'
	document.body.appendChild(el)
	return el
}
