import '@testing-library/jest-dom/vitest'

// jsdom doesn't ship these browser globals; zag-js machines reach for them
// during effect setup (carousel uses IntersectionObserver, drawer/popper use
// ResizeObserver, select calls Element.scrollTo, radio-group uses CSS.escape).
// Stubs let the machines wire up without crashing — tests that actually depend
// on the observer firing aren't covered, but the basic mount/interact paths
// work.
class NoopObserver{

	constructor(){}

	observe(){}

	unobserve(){}

	disconnect(){}

	takeRecords(){ return [] }

}

if (typeof globalThis.IntersectionObserver === 'undefined'){
	globalThis.IntersectionObserver = NoopObserver
}
if (typeof globalThis.ResizeObserver === 'undefined'){
	globalThis.ResizeObserver = NoopObserver
}

if (typeof Element !== 'undefined' && typeof Element.prototype.scrollTo !== 'function'){
	Element.prototype.scrollTo = function scrollTo(){}
}

if (typeof globalThis.CSS === 'undefined'){
	globalThis.CSS = { escape: value=> String(value).replace(/[^a-zA-Z0-9_-]/g, ch=> `\\${ch}`) }
} else if (typeof globalThis.CSS.escape !== 'function'){
	globalThis.CSS.escape = value=> String(value).replace(/[^a-zA-Z0-9_-]/g, ch=> `\\${ch}`)
}
