import { createTree } from '@plastic-js/plastic'

const Button = ({ onClick, children })=> (
	<button onClick={onClick} type='button'>
		{children}
	</button>
)

const Tag = ({ children, variant = 'default' })=> (
	<span className={`tag tag-${variant}`}>
		{children}
	</span>
)

const FunctionWrappedDynamicsShowcase = ()=> {
	const wrappedState = createTree({
		showBadge: true,
		title: 'Draft release',
		statusText: 'warming up',
		className: 'profile-card tone-amber',
		background: '#fff7ed',
		border: '#fdba74',
	})

	const cycleWrappedTone = ()=> {
		if (wrappedState.className.includes('tone-amber')){
			wrappedState.className = 'profile-card tone-teal'
			wrappedState.background = '#ecfeff'
			wrappedState.border = '#67e8f9'
			wrappedState.statusText = 'steady'
			return
		}

		if (wrappedState.className.includes('tone-teal')){
			wrappedState.className = 'profile-card tone-coral'
			wrappedState.background = '#fff1f2'
			wrappedState.border = '#fda4af'
			wrappedState.statusText = 'spiking'
			return
		}

		wrappedState.className = 'profile-card tone-amber'
		wrappedState.background = '#fff7ed'
		wrappedState.border = '#fdba74'
		wrappedState.statusText = 'warming up'
	}

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Function-wrapped dynamics</h1>
			</header>
			<section className='feature-card'>
				<div
					aria-label={()=> ()=> `status:${wrappedState.statusText}`}
					className={wrappedState.className}
					style={()=> ()=> ({
						background: wrappedState.background,
						borderLeft: `4px solid ${wrappedState.border}`,
						padding: '14px',
						borderRadius: '10px',
					})}
					title={()=> ()=> wrappedState.title}
				>
					<strong>
						{()=> ()=> wrappedState.title}
					</strong>
					<p>
						Current status:
						{wrappedState.statusText}
					</p>
					{wrappedState.showBadge ? <Tag variant='warning'>Wrapped child node is mounted</Tag> : null}
				</div>
				<div className='button-row'>
					<Button onClick={()=> { wrappedState.showBadge = !wrappedState.showBadge }}>Toggle wrapped child</Button>
					<Button onClick={cycleWrappedTone}>Cycle wrapped class/style</Button>
					<Button onClick={()=> { wrappedState.title = wrappedState.title === 'Draft release' ? 'Production release' : 'Draft release' }}>Toggle wrapped title</Button>
				</div>
			</section>
		</div>
	)
}

export default FunctionWrappedDynamicsShowcase
