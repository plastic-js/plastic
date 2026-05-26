// @vitest-environment jsdom

import { describe, it, expect } from 'vitest'
import { createContext, useContext, renderApp } from '../src/index.js'

const render = (comp, host)=> renderApp(host, comp())

const Ctx = createContext(null)

const Provider = ({ children })=> Ctx.Provider({ value: { hello: 'world' }, children: ()=> children })

const Consumer = ()=> {
	const ctx = useContext(Ctx)
	return <span>{ctx?.hello ?? 'MISSING'}</span>
}

describe('context-through-static-template bug', ()=> {

	it('Case A: direct child sees context', ()=> {
		const host = document.createElement('div')
		render(()=> <Provider><Consumer /></Provider>, host)
		expect(host.textContent).toBe('world')
	})

	it('Case B: child inside static <div> wrapper sees context', ()=> {
		const host = document.createElement('div')
		render(()=> (
			<Provider>
				<div className="static-wrapper">
					<Consumer />
				</div>
			</Provider>
		), host)
		expect(host.textContent).toBe('world')
	})

})
