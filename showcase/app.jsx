import {
	Either,
	False,
	Link,
	Loop,
	Portal,
	Route,
	Router,
	True,
	createComputed,
	createSignal,
	createTree,
	lazy,
	navigate,
	onCleanup,
	onMount,
	renderApp,
} from '../src/index.js'
import './global.css'

const Loading = ()=> <div className='checklist' style={{ padding: '12px' }}>Loading…</div>

const PageOne = lazy(()=> import('./pages/PageOne.jsx'), { fallback: Loading })
const PageTwo = lazy(()=> import('./pages/PageTwo.jsx'), { fallback: Loading })
const PageOneA = lazy(()=> import('./pages/PageOneA.jsx'), { fallback: Loading })
const PageOneB = lazy(()=> import('./pages/PageOneB.jsx'), { fallback: Loading })
const PageTwoA = lazy(()=> import('./pages/PageTwoA.jsx'), { fallback: Loading })
const PageTwoB = lazy(()=> import('./pages/PageTwoB.jsx'), { fallback: Loading })

const PageTwoNotFound = ()=> (
	<div className='checklist' style={{ marginTop: '10px' }}>
		<h4>404</h4>
		<p>
			This nested route does not exist under
			{' '}
			<code>/page-two</code>
			.
		</p>
	</div>
)

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

const Button = ({
	onClick, children, disabled = false, className = '', type = 'button',
})=> (
	<button
		className={className}
		disabled={disabled}
		onClick={onClick}
		type={type}
	>
		{children}
	</button>
)

const ChildProfileCard = ({
	title,
	name,
	level,
	note,
	profile,
})=> (
	<div className='checklist'>
		<p>
			<strong>
				{title}
			</strong>
		</p>
		<p>
			Name:
			{' '}
			<span>
				{name}
			</span>
		</p>
		<p>
			Level:
			{' '}
			<span>
				{level}
			</span>
		</p>
		<p>
			{note}
		</p>
		<p>
			Role:
			{' '}
			<span>
				{profile.role}
			</span>
		</p>
		<p>
			Streak days:
			{' '}
			<span>
				{profile.streak}
			</span>
		</p>
	</div>
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

const profileName = createSignal('Ava')
const profileLevel = createSignal(1)
const profileNote = createComputed(()=> profileLevel() >= 3 ? 'Ready for advanced tasks' : 'Keep building fundamentals')
const profileTree = createTree({
	role: 'Builder',
	streak: 3,
})

// ─── Event Binding ────────────────────────────────────────────────────────────

const inputValue = createSignal('')
const inputHistory = createSignal([])
const focusCount = createSignal(0)
const hoverCount = createSignal(0)

const handleInputChange = (event)=> {
	inputValue(event.target.value)
}

const handleInputBlur = ()=> {
	if (inputValue().trim()){
		const history = inputHistory()
		inputHistory([...history, inputValue()])
		inputValue('')
	}
}

const handleMouseEnter = ()=> {
	hoverCount(hoverCount() + 1)
}

const handleMouseLeave = ()=> {
	// Just for demonstration
}

const clearInputHistory = ()=> {
	inputHistory([])
	focusCount(0)
}

// ─── Form State Management ────────────────────────────────────────────────────

const formData = createTree({
	name: '',
	email: '',
	message: '',
	submitted: false,
})

const handleFormChange = (field, event)=> {
	formData[field] = event.target.value
}

const handleFormSubmit = (event)=> {
	event.preventDefault()
	if (formData.name.trim() && formData.email.trim()){
		formData.submitted = true
		setTimeout(()=> {
			formData.submitted = false
			formData.name = ''
			formData.email = ''
			formData.message = ''
		}, 2000)
	}
}

// ─── Reactive Props ───────────────────────────────────────────────────────────

const locked = createSignal(false)
const styleMode = createSignal('highlight')

const cardClass = createComputed(()=> ['profile-card', locked() ? 'is-locked' : 'interactive'].join(' '))
const obj1 = {
	background: '#fffbcc', padding: '8px 12px', borderLeft: '3px solid #f0c040',
}
const obj2 = { background: '#e8f5e9', padding: '8px 12px' }
const reactiveStyle = createComputed(()=> styleMode() === 'highlight' ? obj1 : obj2)

// ─── Function-Wrapped Dynamics (Babel reactive transform target) ────────────

const wrappedState = createTree({
	showBadge: true,
	title: 'Draft release',
	statusText: 'warming up',
	className: 'profile-card tone-amber',
	background: '#fff7ed',
	border: '#fdba74',
})

const toggleWrappedBadge = ()=> {
	wrappedState.showBadge = !wrappedState.showBadge
}

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

const updateWrappedTitle = ()=> {
	wrappedState.title = wrappedState.title === 'Draft release' ? 'Production release' : 'Draft release'
}

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

// ─── Either / True / False Control Flow ───────────────────────────────────────

const ifVisible = createSignal(false)
const ifPlan = createSignal('starter')

// ─── Loop List Rendering ───────────────────────────────────────────────────

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

// ─── Portal / Modal ──────────────────────────────────────────────────────────

const portalOpen = createSignal(false)
const portalTheme = createSignal('info')

const Modal = ({ onClose, theme })=> {
	const themeMap = {
		info: {
			bg: '#e8f4fd', border: '#2196f3', icon: 'ℹ️', label: 'Info',
		},
		success: {
			bg: '#e8f5e9', border: '#4caf50', icon: '✓', label: 'Success',
		},
		warning: {
			bg: '#fff8e1', border: '#ff9800', icon: '⚠', label: 'Warning',
		},
	}
	const style = createComputed(()=> themeMap[theme()] ?? themeMap.info)

	return (
		<div className='modal-overlay' onClick={onClose}>
			<div
				className='modal-box'
				onClick={e=> e.stopPropagation()}
				style={createComputed(()=> ({
					borderTop: `4px solid ${style().border}`,
					background: style().bg,
				}))}
			>
				<div className='modal-header'>
					<span className='modal-icon'>
						{createComputed(()=> style().icon)}
					</span>
					<strong>
						Portal modal —
						{' '}
						{createComputed(()=> style().label)}
					</strong>
					<button className='modal-close' onClick={onClose} type='button'>✕</button>
				</div>
				<p className='modal-body'>
					This dialog is rendered via
					{' '}
					<code>&lt;Portal&gt;</code>
					{' '}
					directly into
					{' '}
					<code>document.body</code>
					, outside the
					{' '}
					<code>.app</code>
					{' '}
					container. The parent section never knows it is here, yet all
					{' '}
					reactive signals, effects, and cleanup still work correctly.
				</p>
				<div className='button-row'>
					<Button onClick={()=> portalTheme('info')}>Info</Button>
					<Button onClick={()=> portalTheme('success')}>Success</Button>
					<Button onClick={()=> portalTheme('warning')}>Warning</Button>
					<Button onClick={onClose}>Close</Button>
				</div>
			</div>
		</div>
	)
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
			<h2>Router navigation</h2>
			<p className='feature-copy'>
				Click links to switch route components. The browser URL updates with each navigation.
			</p>
			<div className='button-row' style={{ marginBottom: '12px' }}>
				<Link style={{ textDecoration: 'none' }} to='/page-one'>Go to page one</Link>
				<Link style={{ textDecoration: 'none' }} to='/page-two'>Go to page two</Link>
			</div>
			<div className='button-row' style={{ marginBottom: '12px' }}>
				<Button onClick={()=> navigate('/page-one')}>Navigate to page one</Button>
				<Button onClick={()=> navigate('/page-two')}>Navigate to page two</Button>
			</div>
			<Router>
				<Route component={PageOne} path='/page-one'>
					<Route component={PageOneA} index />
					<Route component={PageOneA} path='/sub-a' />
					<Route component={PageOneB} path='/sub-b' />
				</Route>
				<Route component={PageTwo} path='/page-two'>
					<Route component={PageTwoA} path='/sub-a' />
					<Route component={PageTwoB} path='/sub-b' />
					<Route component={PageTwoNotFound} path='*' />
				</Route>
			</Router>
		</section>
		<section className='feature-card'>
			<h2>Signals & function components</h2>
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
		<section className='feature-card'>
			<h2>Parent to child props</h2>
			<p>Parent passes static and reactive props; child consumes them directly in its own JSX.</p>
			<ChildProfileCard
				level={profileLevel}
				name={profileName}
				note={profileNote}
				profile={profileTree}
				title='Child renderer'
			/>
			<div className='button-row'>
				<Button onClick={()=> profileName(profileName() === 'Ava' ? 'Liam' : 'Ava')}>Toggle name</Button>
				<Button onClick={()=> profileLevel(profileLevel() + 1)}>Level up</Button>
				<Button onClick={()=> {
					profileTree.role = profileTree.role === 'Builder' ? 'Architect' : 'Builder'
				}}
				>
					Toggle role (tree)
				</Button>
				<Button onClick={()=> {
					profileTree.streak += 1
				}}
				>
					+1 streak (tree)
				</Button>
				<Button onClick={()=> profileLevel(1)}>Reset level</Button>
			</div>
		</section>
		<section className='feature-card'>
			<h2>Event binding</h2>
			<p className='feature-copy'>
				The runtime supports
				{' '}
				<code>onXxx</code>
				{' '}
				event props that map to
				{' '}
				<code>addEventListener</code>
				. Events fire for native DOM interactions and cleanup automatically on unmount.
			</p>
			<div className='checklist'>
				<p>
					Input value:
					{' '}
					<strong>
						{inputValue() || '(empty)'}
					</strong>
				</p>
				<p>
					Saved entries:
					{' '}
					<strong>
						{inputHistory().length}
					</strong>
				</p>
				<p>
					Hover count:
					{' '}
					<strong>
						{hoverCount}
					</strong>
				</p>
			</div>
			<div style={{
				display: 'flex', gap: '8px', marginBottom: '12px',
			}}
			>
				<input
					onBlur={handleInputBlur}
					onInput={handleInputChange}
					placeholder='Type and press blur to save'
					style={{
						flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc',
					}}
					type='text'
					value={inputValue}
				/>
				<Button onClick={clearInputHistory}>Clear history</Button>
			</div>
			<div
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				style={{
					padding: '12px',
					background: '#f0f0f0',
					borderRadius: '4px',
					marginBottom: '12px',
				}}
			>
				Hover over this box to increment counter
			</div>
			<Either condition={createComputed(()=> inputHistory().length > 0)}>
				<True>
					<ul style={{ margin: 0, paddingLeft: '20px' }}>
						<Loop each={inputHistory}>
							{(entry, idx)=> (
								<li key={idx}>
									{entry}
								</li>
							)}
						</Loop>
					</ul>
				</True>
			</Either>
		</section>
		<section className='feature-card'>
			<h2>Form handling with tree reactivity</h2>
			<p className='feature-copy'>
				Combine
				{' '}
				<code>createTree</code>
				{' '}
				for form state with event handlers. Direct field mutations update the DOM reactively.
			</p>
			<form
				onSubmit={handleFormSubmit} style={{
					display: 'flex', flexDirection: 'column', gap: '12px',
				}}
			>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<label style={{ marginBottom: '4px', fontWeight: 500 }}>Name:</label>
					<input
						onChange={event=> handleFormChange('name', event)}
						placeholder='Enter your name'
						style={{
							padding: '8px', borderRadius: '4px', border: '1px solid #ccc',
						}}
						type='text'
						value={formData.name}
					/>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<label style={{ marginBottom: '4px', fontWeight: 500 }}>Email:</label>
					<input
						onChange={event=> handleFormChange('email', event)}
						placeholder='Enter your email'
						style={{
							padding: '8px', borderRadius: '4px', border: '1px solid #ccc',
						}}
						type='email'
						value={formData.email}
					/>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column' }}>
					<label style={{ marginBottom: '4px', fontWeight: 500 }}>Message:</label>
					<textarea
						onChange={event=> handleFormChange('message', event)}
						placeholder='Enter your message'
						style={{
							padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px',
						}}
						value={formData.message}
					/>
				</div>
				<div className='button-row'>
					<Button type='submit'>Submit</Button>
				</div>
				<Either condition={createComputed(()=> formData.submitted)}>
					<True>
						<div style={{
							padding: '12px',
							background: '#e8f5e9',
							borderLeft: '3px solid #4caf50',
							borderRadius: '4px',
						}}
						>
							✓ Form submitted successfully! (auto-clears in 2 seconds)
						</div>
					</True>
				</Either>
			</form>
		</section>
		<section className='feature-card'>
			<div className='section-head'>
				<div>
					<h2>Reactive props & computed styles</h2>
					<p>className, style, and attributes bind to signals for live updates.</p>
				</div>
				<Tag variant={tagVariant}>
					{status}
				</Tag>
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
				<div style={reactiveStyle}>
					Reactive style object — switching modes removes stale CSS keys cleanly.
				</div>
				<div className='button-row'>
					<Button onClick={()=> locked(!locked())}>Toggle locked</Button>
					<Button onClick={()=> styleMode(styleMode() === 'highlight' ? 'success' : 'highlight')}>Switch style</Button>
					<Button disabled={locked}>Reactive disabled</Button>
				</div>
			</div>
		</section>
		<section className='feature-card'>
			<h2>Function-wrapped dynamics</h2>
			<p className='feature-copy'>
				The Babel plugin wraps dynamic JSX values into functions. This section verifies wrapped
				children, attributes, className, and style all stay reactive.
			</p>
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
					{' '}
					{ wrappedState.statusText}
				</p>
				{ wrappedState.showBadge ? <Tag variant='warning'>Wrapped child node is mounted</Tag> : null}
			</div>
			<div className='button-row'>
				<Button onClick={toggleWrappedBadge}>Toggle wrapped child</Button>
				<Button onClick={cycleWrappedTone}>Cycle wrapped class/style</Button>
				<Button onClick={updateWrappedTitle}>Toggle wrapped title</Button>
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
				<Button onClick={()=> ternaryVisible(!ternaryVisible())}>
					{ternaryVisible() ? 'Hide panel' : 'Show panel'}
				</Button>
				<Button onClick={()=> ternaryTheme(ternaryTheme() === 'day' ? 'night' : 'day')}>
					{ternaryTheme() === 'day' ? 'Switch to night' : 'Switch to day'}
				</Button>
			</div>
		</section>
		<section className='feature-card'>
			<h2>Control flow with Either</h2>
			<p className='feature-copy'>
				Use
				{' '}
				<code>&lt;Either&gt;</code>
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
			<Either condition={ifVisible}>
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
			</Either>
			<div className='button-row'>
				<Button onClick={()=> ifVisible(!ifVisible())}>
					{createComputed(()=> ifVisible() ? 'Switch to False branch' : 'Switch to True branch')}
				</Button>
				<Button onClick={()=> ifPlan(ifPlan() === 'starter' ? 'pro' : 'starter')}>
					{createComputed(()=> ifPlan() === 'starter' ? 'Upgrade to pro' : 'Downgrade to starter')}
				</Button>
			</div>
		</section>
		<section className='feature-card'>
			<h2>Control flow with Loop</h2>
			<p className='feature-copy'>
				Use
				{' '}
				<code>
					&lt;Loop each=
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
				<Loop each={forItems}>
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
				</Loop>
			</ul>
			<div className='button-row'>
				<Button onClick={addForItem}>Add row</Button>
				<Button onClick={removeLastForItem}>Remove last</Button>
				<Button onClick={rotateForItems}>Rotate</Button>
				<Button onClick={resetForItems}>Reset</Button>
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
				<Button onClick={toggleProbe}>
					{createComputed(()=> probeActive() ? 'Unmount probe' : 'Mount probe')}
				</Button>
			</div>
			<div className='feature-card' id='probe-root'>
				Probe is unmounted.
			</div>
		</section>
		<section className='feature-card'>
			<h2>Portal</h2>
			<p className='feature-copy'>
				Use
				{' '}
				<code>
					&lt;Portal container=
					{'{el}'}
					&gt;
				</code>
				{' '}
				to render children into a DOM node outside the current tree.
				A classic use-case is a modal overlay mounted on
				{' '}
				<code>document.body</code>
				{' '}
				so it sits above all other content regardless of
				{' '}
				<code>z-index</code>
				{' '}
				or overflow rules.
			</p>
			<div className='checklist'>
				<p>
					Modal:
					{' '}
					<strong>
						{createComputed(()=> portalOpen() ? 'open' : 'closed')}
					</strong>
				</p>
				<p>
					Current theme:
					{' '}
					<strong>
						{portalTheme}
					</strong>
				</p>
			</div>
			<div className='button-row'>
				<Button onClick={()=> portalOpen(true)}>Open modal</Button>
			</div>
			<Either condition={portalOpen}>
				<True>
					<Portal>
						<Modal onClose={()=> portalOpen(false)} theme={portalTheme} />
					</Portal>
				</True>
			</Either>
		</section>
	</div>
)

renderApp(document.body.querySelector('.app'), app)
