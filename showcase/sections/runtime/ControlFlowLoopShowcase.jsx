import { Loop, createComputed, createSignal } from '@plastic-js/plastic'

const Button = ({ onClick, children })=> (
	<button onClick={onClick} type='button'>
		{children}
	</button>
)

const createForSeed = ()=> [
	{ id: 'a', label: 'Alpha' },
	{ id: 'b', label: 'Beta' },
	{ id: 'c', label: 'Gamma' },
]

const ControlFlowLoopShowcase = ()=> {
	const forItems = createSignal(createForSeed())

	const addForItem = ()=> {
		const nextIndex = forItems().length + 1
		forItems([...forItems(), { id: `n-${Date.now()}-${nextIndex}`, label: `New ${nextIndex}` }])
	}

	const removeLastForItem = ()=> {
		if (!forItems().length){ return }
		forItems(forItems().slice(0, -1))
	}

	const rotateForItems = ()=> {
		const list = forItems()
		if (list.length < 2){ return }
		forItems([list[list.length - 1], ...list.slice(0, -1)])
	}

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Control flow with Loop</h1>
			</header>
			<section className='feature-card'>
				<div className='checklist'>
					<p>
						Total rows:
						<strong>
							{createComputed(()=> forItems().length)}
						</strong>
					</p>
					<p>Try Rotate to see keyed rows move without remounting unchanged items.</p>
				</div>
				<ul className='checklist'>
					<Loop each={forItems}>
						{(item, index)=> (
							<li>
								<span>
									#
									{index}
								</span>
								<span>
									-
									{item.label}
								</span>
							</li>
						)}
					</Loop>
				</ul>
				<div className='button-row'>
					<Button onClick={addForItem}>Add row</Button>
					<Button onClick={removeLastForItem}>Remove last</Button>
					<Button onClick={rotateForItems}>Rotate</Button>
					<Button onClick={()=> forItems(createForSeed())}>Reset</Button>
				</div>
			</section>
		</div>
	)
}

export default ControlFlowLoopShowcase
