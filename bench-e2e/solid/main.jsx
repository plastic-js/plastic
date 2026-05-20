import { createSignal, For } from 'solid-js'
import { render } from 'solid-js/web'
import { applyDiff, flush, makeHost, makeItems, time } from '../scenarios.js'

const Row = (props)=> <div class='row'><span>item {props.i}</span></div>

const Many = (props)=> {
	const arr = []
	for (let i = 0; i < props.n; i += 1){
		arr.push(<Row i={i} />)
	}
	return <div>{arr}</div>
}

const ListView = (props)=> (
	<ul>
		<For each={props.items()}>
			{(item, index)=> <li><span>#{index()}</span> <span>{item.label}</span></li>}
		</For>
	</ul>
)

window.__bench = {
	async mount(n){
		const host = makeHost()
		let dispose
		const ms = await time(()=> { dispose = render(()=> <Many n={n} />, host) })
		dispose()
		return ms
	},

	async update(iterations){
		const host = makeHost()
		const [count, setCount] = createSignal(0)
		const dispose = render(()=> <p>count: {count()}</p>, host)
		await flush()
		const ms = await time(()=> {
			for (let i = 0; i < iterations; i += 1){
				setCount(i)
			}
		})
		dispose()
		return ms
	},

	async largeList(n){
		const host = makeHost()
		const [items] = createSignal(makeItems(n))
		let dispose
		const ms = await time(()=> {
			dispose = render(()=> <ListView items={items} />, host)
		})
		dispose()
		return ms
	},

	async diff(n, op){
		const host = makeHost()
		const initial = makeItems(n)
		const [items, setItems] = createSignal(initial)
		const dispose = render(()=> <ListView items={items} />, host)
		await flush()
		const ms = await time(()=> {
			setItems(applyDiff(initial, op))
		})
		dispose()
		return ms
	},
}

window.__benchReady = true
