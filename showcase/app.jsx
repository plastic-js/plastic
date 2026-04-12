import {
	computed,
	renderApp,
	signal,
} from '../src/jsx-runtime.js'
import './global.css'

// ─── Function Components ──────────────────────────────────────────────────────

// Accepts static and reactive props; renders a labelled metric tile.
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

// Wraps children in a coloured pill; `variant` controls the modifier class.
const Tag = ({ children, variant = 'default' })=> (
	<span className={`tag tag-${variant}`}>
		{children}
	</span>
)

// Uses a reactive prop to drive a status tag and a metric tile together.
const taps = signal(0)
const tapStatus = computed(()=> taps() >= 5 ? 'hot' : taps() >= 2 ? 'warm' : 'cool')
const tapVariant = computed(()=> taps() >= 5 ? 'danger' : taps() >= 2 ? 'warning' : 'info')
const incrementTaps = ()=> taps(taps() + 1)
const resetTaps = ()=> taps(0)

const profileIndex = signal(0)
const buttonLocked = signal(false)

const profiles = [
	{
		name: 'Ada Lovelace',
		role: 'Analytical Engine Notes',
		handle: 'ada',
		email: 'ada@signals.dev',
	},
	{
		name: 'Grace Hopper',
		role: 'Compiler Pioneer',
		handle: 'grace',
		email: 'grace@signals.dev',
	},
	{
		name: 'Margaret Hamilton',
		role: 'Apollo Flight Software',
		handle: 'margaret',
		email: 'margaret@signals.dev',
	},
]

const activeProfile = computed(()=> profiles[profileIndex()])
const reactiveLabel = computed(()=> `Current profile: ${activeProfile().name}`)
const reactiveDescription = computed(()=> `${activeProfile().role} · @${activeProfile().handle}`)
const badgeLabel = computed(()=> {
	return buttonLocked() ? 'Props are locked' : 'Props are live'
})
const profileTone = computed(()=> ['tone-amber', 'tone-teal', 'tone-coral'][profileIndex()])
const profileCardClassName = computed(()=> {
	return [
		'profile-card',
		'profile-shell',
		buttonLocked() ? 'is-locked' : 'interactive',
		profileTone(),
		profileIndex() % 2 === 0 ? 'layout-wide' : 'layout-compact',
	].join(' ')
})
const classSummary = 'Reactive className now directly controls .interactive and .is-locked classes.'

const styleMode = signal('highlight')
const reactiveStyle = computed(()=> styleMode() === 'highlight'
	? {
		background: '#fffbcc',
		padding: '8px 12px',
		borderLeft: '3px solid #f0c040',
	}
	: {
		background: '#e8f5e9',
		padding: '8px 12px',
	})
const cycleStyleMode = ()=> {
	styleMode(styleMode() === 'highlight' ? 'success' : 'highlight')
}

const autoFocusEnabled = signal(false)
const toggleAutoFocus = ()=> autoFocusEnabled(!autoFocusEnabled())

const cycleProfile = ()=> {
	profileIndex((profileIndex() + 1) % profiles.length)
}

const toggleLock = ()=> {
	buttonLocked(!buttonLocked())
}

const app = (
	<div className='container'>
		<header className='hero'>
			<p className='eyebrow'>Custom JSX runtime</p>
			<h1>Reactive props showcase</h1>
			<p className='hero-copy'>
				Signals, computed values, and getter sources now update DOM props directly instead of only changing text nodes.
			</p>
		</header>
		<section className='feature-card'>
			<div className='section-head'>
				<div>
					<h2>Live prop bindings</h2>
					<p>
						{reactiveLabel}
					</p>
				</div>
				<span className='status-pill'>
					{badgeLabel}
				</span>
			</div>
			<p className='feature-copy'>
				The card below binds title, aria-label, htmlFor, value, placeholder, and boolean disabled props from reactive sources.
			</p>
			<div
				aria-label={()=> `Profile card for ${activeProfile().name}`}
				className={profileCardClassName}
				title={computed(()=> `${activeProfile().name} · ${activeProfile().role}`)}
			>
				<p className='profile-kicker'>
					{reactiveDescription}
				</p>
				<p className='class-note'>
					{classSummary}
				</p>
				<h3>
					{computed(()=> activeProfile().name)}
				</h3>
				<div className='field-grid'>
					<label htmlFor={computed(()=> `contact-${activeProfile().handle}`)}>Contact email</label>
					<input
						id={computed(()=> `contact-${activeProfile().handle}`)}
						placeholder={()=> `Message ${activeProfile().name}`}
						readOnly
						value={computed(()=> activeProfile().email)}
					/>
				</div>
				<div className='button-row'>
					<button onClick={cycleProfile} type='button'>Next profile</button>
					<button onClick={toggleLock} type='button'>Toggle disabled prop</button>
					<button disabled={buttonLocked} type='button'>Reactive disabled</button>
				</div>
			</div>
		</section>
		<section className='feature-card'>
			<h2>Reactive style</h2>
			<p className='feature-copy'>
				The box below binds its style prop to a computed object. Switching modes removes the old borderLeft key and applies new values without leaving stale properties behind.
			</p>
			<div style={reactiveStyle}>
				Style object updates reactively. Current mode:
				{' '}
				<strong>
					{styleMode}
				</strong>
			</div>
			<div className='button-row'>
				<button onClick={cycleStyleMode} type='button'>Switch style mode</button>
			</div>
		</section>
		<section className='feature-card'>
			<h2>JSX prop name mapping</h2>
			<p className='feature-copy'>
				JSX camelCase props like
				{' '}
				<code>autoFocus</code>
				{' '}
				and
				{' '}
				<code>autoComplete</code>
				{' '}
				are automatically mapped to the correct lowercase DOM properties (
				<code>autofocus</code>
				,
				{' '}
				<code>autocomplete</code>
				) before being applied.
			</p>
			<div className='field-grid'>
				<label htmlFor='search-box'>Search (autoComplete=off)</label>
				<input
					autoComplete='off'
					id='search-box'
					placeholder='autocomplete is off'
					type='search'
				/>
			</div>
			<div className='field-grid'>
				<label htmlFor='focus-input'>Input with reactive autoFocus</label>
				<input
					autoFocus={autoFocusEnabled}
					id='focus-input'
					placeholder='toggle autofocus below'
					type='text'
				/>
			</div>
			<div className='button-row'>
				<button onClick={toggleAutoFocus} type='button'>
					Toggle autoFocus (currently:
					{' '}
					{computed(()=> (autoFocusEnabled() ? 'on' : 'off'))}
					)
				</button>
			</div>
		</section>
		<section className='feature-card'>
			<div className='section-head'>
				<div>
					<h2>Function components</h2>
					<p>Components are plain functions that receive props and return DOM nodes.</p>
				</div>
				<Tag variant={tapVariant}>
					{tapStatus}
				</Tag>
			</div>
			<p className='feature-copy'>
				<code>StatCard</code>
				{' '}
				receives a reactive signal as its
				<code>value</code>
				{' '}
				prop — the binding stays live inside the component without any extra wiring.
				<code>Tag</code>
				{' '}
				receives children injected via
				<code>props.children</code>
				.
			</p>
			<div className='stat-grid'>
				<StatCard title='Tap count' unit=' taps' value={taps} />
				<StatCard title='Status' value={tapStatus} />
			</div>
			<div className='button-row'>
				<button onClick={incrementTaps} type='button'>Tap</button>
				<button onClick={resetTaps} type='button'>Reset</button>
			</div>
		</section>
		<section className='feature-card'>
			<h2>What to inspect</h2>
			<div className='checklist'>
				<p>Hover the card to see its title update when the active profile changes.</p>
				<p>The label stays connected to the input because htmlFor and id move together.</p>
				<p>The third button flips its disabled property from a signal without re-creating the element.</p>
				<p>The input placeholder comes from a getter source, not a signal object.</p>
				<p>The card style and tone are fully controlled by a single reactive className value.</p>
			</div>
		</section>
	</div>
)

renderApp(document.body.querySelector('.app'), app)
