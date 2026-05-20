import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { applyDiff, flush, makeHost, makeItems, time } from '../scenarios.js'

const Row = ({ i })=> <div className='row'><span>item {i}</span></div>

const Many = ({ n })=> {
	const arr = []
	for (let i = 0; i < n; i += 1){
		arr.push(<Row i={i} key={i} />)
	}
	return <div>{arr}</div>
}

const List = ({ items })=> (
	<ul>
		{items.map((item, index)=> (
			<li key={item.id}><span>#{index}</span> <span>{item.label}</span></li>
		))}
	</ul>
)

// External-handle counter so the bench can drive setState from outside.
let setCount
const Counter = ()=> {
	const [c, set] = useState(0)
	setCount = set
	return <p>count: {c}</p>
}

let setListItems
const StatefulList = ({ initial })=> {
	const [items, set] = useState(initial)
	setListItems = set
	return <List items={items} />
}

window.__bench = {
	async mount(n){
		const host = makeHost()
		const root = createRoot(host)
		const ms = await time(()=> { flushSync(()=> root.render(<Many n={n} />)) })
		root.unmount()
		return ms
	},

	async update(iterations){
		const host = makeHost()
		const root = createRoot(host)
		flushSync(()=> root.render(<Counter />))
		await flush()
		const ms = await time(()=> {
			for (let i = 0; i < iterations; i += 1){
				flushSync(()=> setCount(i))
			}
		})
		root.unmount()
		return ms
	},

	async largeList(n){
		const host = makeHost()
		const root = createRoot(host)
		const ms = await time(()=> { flushSync(()=> root.render(<List items={makeItems(n)} />)) })
		root.unmount()
		return ms
	},

	async diff(n, op){
		const host = makeHost()
		const root = createRoot(host)
		const initial = makeItems(n)
		flushSync(()=> root.render(<StatefulList initial={initial} />))
		await flush()
		const ms = await time(()=> {
			flushSync(()=> setListItems(applyDiff(initial, op)))
		})
		root.unmount()
		return ms
	},
}

window.__benchReady = true
