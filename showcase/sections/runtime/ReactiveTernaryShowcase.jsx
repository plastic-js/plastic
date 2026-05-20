import { createComputed, createSignal } from '@plastic-js/plastic'

const Button = ({ onClick, children })=> (
	<button onClick={onClick} type='button'>
		{children}
	</button>
)

const ReactiveTernaryShowcase = ()=> {
	const ternaryVisible = createSignal(true)
	const ternaryTheme = createSignal('day')
	const ternaryPanelStyle = createComputed(()=> {
		if (!ternaryVisible()){ return { display: 'none' } }
		return {
			padding: '12px 16px',
			background: ternaryTheme() === 'day' ? '#fffbcc' : '#1e1e2e',
			color: ternaryTheme() === 'day' ? '#333' : '#cdd6f4',
			borderRadius: '6px',
		}
	})

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Reactive ternary</h1>
			</header>
			<section className='feature-card'>
				<div className='checklist'>
					<p>
						Panel:
						<strong>
							{ternaryVisible() ? 'visible' : 'hidden'}
						</strong>
					</p>
					<p>
						Theme:
						<strong>
							{ternaryTheme() === 'day' ? 'Day' : 'Night'}
						</strong>
					</p>
				</div>
				<div style={ternaryPanelStyle}>
					{ternaryTheme() === 'day' ? 'Bright day panel - switch theme or hide me.' : 'Dark night panel - switch theme or hide me.'}
				</div>
				<div className='button-row'>
					<Button onClick={()=> ternaryVisible(!ternaryVisible())}>
						{ternaryVisible() ? 'Hide panel' : 'Show panel'}
					</Button>
					<Button onClick={()=> ternaryTheme(ternaryTheme() === 'day' ? 'night' : 'day')}>
						{ternaryTheme() === 'day' ? 'Switch to night' : 'Switch to day'}
					</Button>
				</div>
			</section>
		</div>
	)
}

export default ReactiveTernaryShowcase
