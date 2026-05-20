import { createSignal, onCleanup, onMount, renderApp } from '@plastic-js/plastic'

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
		const host = document.querySelector('#runtime-probe-root')
		if (host){ host.textContent = 'Probe unmounted.' }
		return
	}

	const host = document.querySelector('#runtime-probe-root')
	if (!host){ return }
	host.textContent = ''
	probeDisposer = renderApp(host, <Probe />)
	probeActive(true)
}

const LifecycleDisposeShowcase = ()=> (
	<div className='container'>
		<header className='hero'>
			<p className='eyebrow'>Runtime Section</p>
			<h1>Lifecycle and dispose</h1>
		</header>
		<section className='feature-card'>
			<div className='stat-grid'>
				<StatCard title='Mounted' value={mountedCount} />
				<StatCard title='Cleaned up' value={cleanupCount} />
			</div>
			<div className='button-row'>
				<Button onClick={toggleProbe}>
					{()=> probeActive() ? 'Unmount probe' : 'Mount probe'}
				</Button>
			</div>
			<div className='feature-card' id='runtime-probe-root'>Probe is unmounted.</div>
		</section>
	</div>
)

export default LifecycleDisposeShowcase
