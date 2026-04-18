import {
	Fragment,
	computed,
	createBindingEffect,
	h,
	jsx,
	jsxs,
	onMount,
	registerCleanup,
	renderApp,
	signal,
} from './jsx-runtime.js'

const createEffect = fn=> createBindingEffect(fn)
const onCleanup = fn=> registerCleanup(fn)

export {
	Fragment,
	h,
	jsx,
	jsxs,
	onMount,
	onCleanup,
	renderApp,
	createEffect,
}

export { signal as createSignal, computed as createComputed }
