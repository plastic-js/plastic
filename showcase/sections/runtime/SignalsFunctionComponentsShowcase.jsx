import { createComputed, createSignal } from '@plastic-js/plastic'

const StatCard = ({ title, value })=> (
	<div className='stat-card'>
		<span className='stat-label'>
			{title}
		</span>
		<span className='stat-value'>
			{value}
		</span>
	</div>
)

const Button = ({ onClick, children })=> (
	<button onClick={onClick} type='button'>
		{children}
	</button>
)

const SignalsFunctionComponentsShowcase = ()=> {
	const count = createSignal(0)
	const status = createComputed(()=> {
		if (count() >= 5){ return 'hot' }
		return count() >= 2 ? 'warm' : 'cool'
	})

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Signals and function components</h1>
			</header>
			<section className='feature-card'>
				<p>Reactive signals passed as props stay live inside child components.</p>
				<div className='stat-grid'>
					<StatCard title='Count' value={count} />
					<StatCard title='Status' value={status} />
				</div>
				<div className='button-row'>
					<Button onClick={()=> count(count() + 1)}>Increment</Button>
					<Button onClick={()=> count(0)}>Reset</Button>
				</div>
			</section>
		</div>
	)
}

export default SignalsFunctionComponentsShowcase
