import { createComputed, createSignal } from '@plastic-js/plastic'

const Button = ({
	onClick, children, disabled = false,
})=> (
	<button disabled={disabled} onClick={onClick} type='button'>
		{children}
	</button>
)

const Tag = ({ children, variant = 'default' })=> (
	<span className={`tag tag-${variant}`}>
		{children}
	</span>
)

const ReactivePropsShowcase = ()=> {
	const count = createSignal(0)
	const status = createComputed(()=> {
		if (count() >= 5){ return 'hot' }
		return count() >= 2 ? 'warm' : 'cool'
	})
	const tagVariant = createComputed(()=> {
		if (count() >= 5){ return 'danger' }
		return count() >= 2 ? 'warning' : 'info'
	})
	const locked = createSignal(false)
	const styleMode = createSignal('highlight')
	const cardClass = createComputed(()=> ['profile-card', locked() ? 'is-locked' : 'interactive'].join(' '))
	const obj1 = {
		background: '#fffbcc', padding: '8px 12px', borderLeft: '3px solid #f0c040',
	}
	const obj2 = { background: '#e8f5e9', padding: '8px 12px' }
	const reactiveStyle = createComputed(()=> styleMode() === 'highlight' ? obj1 : obj2)

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Reactive props and computed styles</h1>
			</header>
			<section className='feature-card'>
				<div className='section-head'>
					<div>
						<p>className, style, and attributes bind to signals for live updates.</p>
					</div>
					<Tag variant={tagVariant}>
						{status}
					</Tag>
				</div>
				<div className='button-row'>
					<Button onClick={()=> count(count() + 1)}>Increase status</Button>
					<Button onClick={()=> count(0)}>Reset status</Button>
				</div>
				<div className={cardClass}>
					<p className='profile-kicker'>
						className is
						{' '}
						<strong>
							{createComputed(()=> locked() ? 'is-locked' : 'interactive')}
						</strong>
						. Style mode is
						{' '}
						<strong>
							{styleMode}
						</strong>
						.
					</p>
					<div style={reactiveStyle}>Reactive style object - switching modes removes stale CSS keys cleanly.</div>
					<div className='button-row'>
						<Button onClick={()=> locked(!locked())}>Toggle locked</Button>
						<Button onClick={()=> styleMode(styleMode() === 'highlight' ? 'success' : 'highlight')}>Switch style</Button>
						<Button disabled={locked}>Reactive disabled</Button>
					</div>
				</div>
			</section>
		</div>
	)
}

export default ReactivePropsShowcase
