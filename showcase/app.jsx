import {
	False,
	For,
	If,
	True,
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
const obj1 = {
	background: '#fffbcc', padding: '8px 12px', borderLeft: '3px solid #f0c040',
}
const obj2 = { background: '#e8f5e9', padding: '8px 12px' }
const reactiveStyle = createComputed(()=> styleMode() === 'highlight' ? obj1 : obj2)

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

// ─── Reactive Ternary ─────────────────────────────────────────────────────────

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

// ─── If / True / False Control Flow ─────────────────────────────────────────

const ifVisible = createSignal(false)
const ifPlan = createSignal('starter')

// ─── For List Rendering ─────────────────────────────────────────────────────

const createForSeed = ()=> [
	{ id: 'a', label: 'Alpha' },
	{ id: 'b', label: 'Beta' },
	{ id: 'c', label: 'Gamma' },
]

const forItems = createSignal(createForSeed())
const forEpoch = createSignal(0)
const bumpForEpoch = ()=> forEpoch(forEpoch() + 1)

const addForItem = ()=> {
	const nextIndex = forItems().length + 1
	forItems([
		...forItems(),
		{ id: `n-${Date.now()}-${nextIndex}`, label: `New ${nextIndex}` },
	])
	bumpForEpoch()
}

const removeLastForItem = ()=> {
	if (!forItems().length){
		return
	}
	forItems(forItems().slice(0, -1))
	bumpForEpoch()
}

const rotateForItems = ()=> {
	const list = forItems()
	if (list.length < 2){
		return
	}
	forItems([list[list.length - 1], ...list.slice(0, -1)])
	bumpForEpoch()
}

const resetForItems = ()=> {
	forItems(createForSeed())
	bumpForEpoch()
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
			<h2>Reactive ternary</h2>
			<p className='feature-copy'>
				The Babel plugin wraps inline ternaries in arrow functions automatically, so they
				react to signal changes without a manual
				{' '}
				<code>createComputed</code>
				{' '}
				call.
			</p>
			<div className='checklist'>
				<p>
					Panel:
					{' '}
					<strong>
						{ternaryVisible() ? 'visible' : 'hidden'}
					</strong>
				</p>
				<p>
					Theme:
					{' '}
					<strong>
						{ternaryTheme() === 'day' ? 'Day' : 'Night'}
					</strong>
				</p>
			</div>
			<div style={ternaryPanelStyle}>
				{ternaryTheme() === 'day' ? 'Bright day panel — switch theme or hide me.' : 'Dark night panel — switch theme or hide me.'}
			</div>
			<div className='button-row'>
				<button onClick={()=> ternaryVisible(!ternaryVisible())} type='button'>
					{ternaryVisible() ? 'Hide panel' : 'Show panel'}
				</button>
				<button onClick={()=> ternaryTheme(ternaryTheme() === 'day' ? 'night' : 'day')} type='button'>
					{ternaryTheme() === 'day' ? 'Switch to night' : 'Switch to day'}
				</button>
			</div>
		</section>
		<section className='feature-card'>
			<h2>Control flow with If</h2>
			<p className='feature-copy'>
				Use
				{' '}
				<code>&lt;If&gt;</code>
				{' '}
				with
				{' '}
				<code>&lt;True&gt;</code>
				/
				<code>&lt;False&gt;</code>
				{' '}
				to lazily render only the active branch.
			</p>
			<div className='checklist'>
				<p>
					Active branch:
					{' '}
					<strong>
						{createComputed(()=> ifVisible() ? 'True' : 'False')}
					</strong>
				</p>
				<p>
					Selected plan:
					{' '}
					<strong>
						{ifPlan}
					</strong>
				</p>
			</div>
			<If condition={ifVisible}>
				<True>
					<div className='checklist'>
						<p>Welcome back! You can now access the dashboard branch.</p>
						<p>
							Current perks:
							{' '}
							<strong>
								{createComputed(()=> ifPlan() === 'pro' ? 'Priority support + analytics' : 'Starter toolkit')}
							</strong>
						</p>
					</div>
				</True>
				<False>
					<div className='checklist'>
						<p>You are viewing the public branch.</p>
						<p>Flip the toggle to mount the private branch content.</p>
					</div>
				</False>
			</If>
			<div className='button-row'>
				<button onClick={()=> ifVisible(!ifVisible())} type='button'>
					{createComputed(()=> ifVisible() ? 'Switch to False branch' : 'Switch to True branch')}
				</button>
				<button onClick={()=> ifPlan(ifPlan() === 'starter' ? 'pro' : 'starter')} type='button'>
					{createComputed(()=> ifPlan() === 'starter' ? 'Upgrade to pro' : 'Downgrade to starter')}
				</button>
			</div>
		</section>
		<section className='feature-card'>
			<h2>Control flow with For</h2>
			<p className='feature-copy'>
				Use
				{' '}
				<code>
					&lt;For each=
					{'{'}
					items
					{'}'}
					&gt;
				</code>
				{' '}
				for list rendering with an
				{' '}
				<code>index()</code>
				{' '}
				accessor. This demo also uses
				{' '}
				<code>
					key=
					{'{(item) => item.id}'}
				</code>
				{' '}
				to keep stable rows when reordering.
			</p>
			<div className='checklist'>
				<p>
					Total rows:
					{' '}
					<strong>
						{createComputed(()=> forItems().length)}
					</strong>
				</p>
				<p>Try "Rotate" to see keyed rows move without remounting unchanged items.</p>
			</div>
			<ul className='checklist'>
				<For each={forItems} key={item=> `${forEpoch()}-${item.id}`}>
					{(item, index)=> (
						<li>
							#
							{index}
							{' '}
							-
							{' '}
							{item.label}
						</li>
					)}
				</For>
			</ul>
			<div className='button-row'>
				<button onClick={addForItem} type='button'>Add row</button>
				<button onClick={removeLastForItem} type='button'>Remove last</button>
				<button onClick={rotateForItems} type='button'>Rotate</button>
				<button onClick={resetForItems} type='button'>Reset</button>
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
