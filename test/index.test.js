import { describe, expect, it } from 'vitest'
import * as api from '../src/index.js'

// Guards the public surface of the package. Treat as a snapshot of what is
// promised externally — adding/removing an export should be an intentional
// decision before release.
describe('public API exports', ()=> {
	const expectedExports = [
		// JSX runtime
		'h', 'jsx', 'jsxs', 'Fragment',
		// rendering
		'renderApp', 'Portal', 'Dynamic',
		// reactivity
		'createSignal', 'createComputed', 'createEffect', 'createTree', 'batch', 'createAsync',
		// lifecycle
		'onMount', 'onCleanup',
		// context
		'createContext', 'useContext',
		// control flow
		'Match', 'Case', 'Default', 'Either', 'True', 'False', 'Loop',
		// router
		'Router', 'Route', 'Outlet', 'Link', 'NavLink', 'lazy',
		'navigate',
		'useLocation', 'useMatch', 'useNavigate', 'useNavigationState',
		'useParams', 'useRoute', 'useSearchParams',
		// props
		'mergeProps', 'splitProps', 'createSplitProps',
	]

	for (const name of expectedExports){
		it(`exports ${name}`, ()=> {
			expect(api[name]).toBeDefined()
		})
	}

	it('does not export unexpected names', ()=> {
		const actual = Object.keys(api).sort()
		const expected = [...expectedExports].sort()
		expect(actual).toEqual(expected)
	})

	it('aliases registerCleanup as onCleanup', ()=> {
		expect(typeof api.onCleanup).toBe('function')
	})

	it('aliases createBindingEffect as createEffect', ()=> {
		expect(typeof api.createEffect).toBe('function')
	})
})
