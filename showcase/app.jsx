import {
	computed,
	renderApp,
	signal,
} from '../src/jsx-runtime.js'
import './global.css'

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
		profileIndex() % 2 === 0 ? 'layout-wide' : 'layout-compact',
	].join(' ')
})
const classSummary = computed(()=> {
	return buttonLocked() ? 'Reactive className keeps the base shell classes while classList disables .interactive and enables .is-locked.' : 'Reactive className keeps the base shell classes while classList enables .interactive and removes .is-locked.'
})
const profileCardClassList = computed(()=> {
	return {
		interactive: !buttonLocked(),
		'is-locked': buttonLocked(),
		'tone-teal': false,
		'tone-coral': false,
		'tone-amber': false,
		[profileTone()]: true,
	}
})

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
				classList={profileCardClassList}
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
			<h2>What to inspect</h2>
			<div className='checklist'>
				<p>Hover the card to see its title update when the active profile changes.</p>
				<p>The label stays connected to the input because htmlFor and id move together.</p>
				<p>The third button flips its disabled property from a signal without re-creating the element.</p>
				<p>The input placeholder comes from a getter source, not a signal object.</p>
				<p>The card mixes reactive className and reactive classList; classList wins when they disagree.</p>
			</div>
		</section>
	</div>
)

renderApp(document.body.querySelector('.app'), app)
