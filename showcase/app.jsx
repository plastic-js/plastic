import {
	createComputed,
	createSignal,
	onCleanup,
	onMount,
	renderApp,
} from '../src/index.js'
import './global.css'

// ─── Components ───────────────────────────────────────────────────────────────

const StatCard = ({
	title, value, unit = '',
})=> (
	<div className='stat-card'>
		<span className='stat-label'>
			{title}
		</span>
		<span className='stat-value'>
			{value}
			{unit}
		</span>
	</div>
)

const Tag = ({ children, variant = 'default' })=> (
	<span className={`tag tag-${variant}`}>
		{children}
	</span>
)

// ─── Signals & Function Components ───────────────────────────────────────────

const count = createSignal(0)
const status = createComputed(()=> {
	if (count() >= 5){ return 'hot' }
	return count() >= 2 ? 'warm' : 'cool'
})
const tagVariant = createComputed(()=> {
	if (count() >= 5){ return 'danger' }
	return count() >= 2 ? 'warning' : 'info'
})

// ─── Reactive Props ───────────────────────────────────────────────────────────

const locked = createSignal(false)
const styleMode = createSignal('highlight')

const cardClass = createComputed(()=> ['profile-card', locked() ? 'is-locked' : 'interactive'].join(' '))

const reactiveStyle = createComputed(()=> (styleMode() === 'highlight'		? {
 background: '#fffbcc', padding: '8px 12px', borderLeft: '3px solid #f0c040' 
}		: { background: '#e8f5e9', padding: '8px 12px' }),)

// ─── Lifecycle ────────────────────────────────────────────────────────────────

const mountedCount = createSignal(0)
const cleanupCount = createSignal(0)
const probeActive = createSignal(false)

const Probe = ()=> {
	const elapsed = createSignal(0)
	let timer = null

	onMount(()=> {
		mountedCount(mountedCount() + 1)
		timer = setInterval(()=> elapsed(elapsed() + 1), 1000)
	})

	onCleanup(()=> {
		cleanupCount(cleanupCount() + 1)
		clearInterval(timer)
	})

	return (
		<div className='checklist'>
			<p>Probe mounted. Timer stops immediately on unmount.</p>
			<p>
				Elapsed:
				{' '}
				<strong>
					{elapsed}
				</strong>
				{' '}
				s
			</p>
		</div>
	)
}

let probeDisposer = null

const toggleProbe = ()=> {
	if (probeDisposer){
		probeDisposer()
		probeDisposer = null
		probeActive(false)
		const host = document.querySelector('#probe-root')
		if (host){
			host.textContent = 'Probe unmounted.'
		}
	} else {
		const host = document.querySelector('#probe-root')
		if (!host){
			return
		}
		host.textContent = ''
		probeDisposer = renderApp(host, <Probe />)
		probeActive(true)
	}
}

// ─── App ──────────────────────────────────────────────────────────────────────

const app = (
	<div className='container'>
		<header className='hero'>
			<p className='eyebrow'>Custom JSX runtime</p>
			<h1>Signals & reactive props</h1>
			<p className='hero-copy'>
				Signals, computed values, and reactive prop bindings — DOM updates without a virtual DOM.
			</p>
		</header>
		<section className='feature-card'>
			<div className='section-head'>
				<div>
					<h2>Signals & function components</h2>
					<p>Reactive signals passed as props stay live inside child components.</p>
				</div>
				<Tag variant={tagVariant}>
					{status}
				</Tag>
			</div>
			<div className='stat-grid'>
				<StatCard title='Count' value={count} />
				<StatCard title='Status' value={status} />
			</div>
			<div className='button-row'>
				<button onClick={()=> count(count() + 1)} type='button'>Increment</button>
				<button onClick={()=> count(0)} type='button'>Reset</button>
			</div>
		</section>
		<section className='feature-card'>
			<h2>Reactive props</h2>
			<p className='feature-copy'>
				className, style, and boolean attributes bind to signals and update without re-creating elements.
			</p>
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
				<div style={reactiveStyle}>
					Reactive style object — switching modes removes stale CSS keys cleanly.
				</div>
				<div className='button-row'>
					<button onClick={()=> locked(!locked())} type='button'>Toggle locked</button>
					<button onClick={()=> styleMode(styleMode() === 'highlight' ? 'success' : 'highlight')} type='button'>Switch style</button>
					<button disabled={locked} type='button'>Reactive disabled</button>
				</div>
			</div>
		</section>
		<section className='feature-card'>
			<h2>Lifecycle & dispose</h2>
			<p className='feature-copy'>
				Mount a subtree with
				{' '}
				<code>renderApp()</code>
				{' '}
				and dispose it with the returned function.
				{' '}
				<code>onMount</code>
				{' '}
				and
				{' '}
				<code>onCleanup</code>
				{' '}
				fire at the correct times.
			</p>
			<div className='stat-grid'>
				<StatCard title='Mounted' value={mountedCount} />
				<StatCard title='Cleaned up' value={cleanupCount} />
			</div>
			<div className='button-row'>
				<button onClick={toggleProbe} type='button'>
					{createComputed(()=> probeActive() ? 'Unmount probe' : 'Mount probe')}
				</button>
			</div>
			<div className='feature-card' id='probe-root'>
				Probe is unmounted.
			</div>
		</section>
	</div>
)

renderApp(document.body.querySelector('.app'), app)
