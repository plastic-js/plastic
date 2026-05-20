import { Loop, createComputed, createSignal, renderApp } from '@plastic-js/plastic'
import { applyDiff, flush, makeHost, makeItems, time } from '../scenarios.js'

const Row = ({ i })=> <div className='row'><span>item {i}</span></div>

const Many = ({ n })=> {
	const arr = []
	for (let i = 0; i < n; i += 1){
		arr.push(<Row i={i} key={i} />)
	}
	return <div>{arr}</div>
}

const ListRow = (item, index)=> <li><span>#{index}</span> <span>{item.label}</span></li>

window.__bench = {
	async mount(n){
		const host = makeHost()
		let dispose
		const ms = await time(()=> { dispose = renderApp(host, <Many n={n} />) })
		dispose?.()
		return ms
	},

	async update(iterations){
		const host = makeHost()
		const count = createSignal(0)
		const dispose = renderApp(host, <p>count: {createComputed(()=> count())}</p>)
		await flush()
		const ms = await time(()=> {
			for (let i = 0; i < iterations; i += 1){
				count(i)
			}
		})
		dispose()
		return ms
	},

	async largeList(n){
		const host = makeHost()
		const items = createSignal(makeItems(n))
		let dispose
		const ms = await time(()=> {
			dispose = renderApp(host, <ul><Loop each={items}>{ListRow}</Loop></ul>)
		})
		dispose()
		return ms
	},

	async diff(n, op){
		const host = makeHost()
		const items = createSignal(makeItems(n))
		const dispose = renderApp(host, <ul><Loop each={items}>{ListRow}</Loop></ul>)
		await flush()
		const ms = await time(()=> {
			items(applyDiff(items(), op))
		})
		dispose()
		return ms
	},
}

window.__benchReady = true
