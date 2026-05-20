import {
	createContext, createSignal, useContext,
} from '@plastic-js/plastic'

const ThemeContext = createContext('light')
const UserContext = createContext({ name: 'Guest', role: 'visitor' })

const inlineCode = {
	width: 'auto',
	display: 'inline',
	border: 'none',
	padding: '2px 6px',
	borderRadius: '4px',
	background: 'rgba(15, 23, 42, 0.08)',
	fontFamily: 'monospace',
	fontSize: '0.9em',
}

const read = (v)=> (typeof v === 'function' ? v() : v)

const ThemedLabel = ()=> {
	const theme = useContext(ThemeContext)
	return (
		<span
			style={()=> ({
				padding: '4px 10px',
				borderRadius: '6px',
				background: read(theme) === 'dark' ? '#1e293b' : '#e2e8f0',
				color: read(theme) === 'dark' ? '#f8fafc' : '#0f172a',
			})}
		>
			Theme: {()=> read(theme)}
		</span>
	)
}

const UserBadge = ()=> {
	const user = useContext(UserContext)
	return (
		<p>
			Hello <strong>{()=> read(user).name}</strong> ({()=> read(user).role})
		</p>
	)
}

const Card = ({ title, children })=> (
	<div className='feature-card' style={{ marginTop: '12px' }}>
		<h3 style={{ marginTop: 0 }}>{title}</h3>
		{children}
	</div>
)

const ContextProviderShowcase = ()=> {
	const theme = createSignal('light')
	const user = createSignal({ name: 'Ada', role: 'admin' })

	const toggleTheme = ()=> theme(theme() === 'light' ? 'dark' : 'light')
	const switchUser = ()=> user(
		user().name === 'Ada'
			? { name: 'Linus', role: 'guest' }
			: { name: 'Ada', role: 'admin' },
	)

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Context Provider</h1>
				<p className='feature-copy'>
					<code style={inlineCode}>createContext</code> + <code style={inlineCode}>Context.Provider</code> share
					reactive values down the tree; <code style={inlineCode}>useContext</code> reads the
					nearest provider value.
				</p>
			</header>

			<section className='feature-card'>
				<div className='button-row'>
					<button onClick={toggleTheme} type='button'>Toggle theme</button>
					<button onClick={switchUser} type='button'>Switch user</button>
				</div>

				<ThemeContext.Provider value={theme}>
					<UserContext.Provider value={user}>
						<Card title='Outer providers'>
							<ThemedLabel />
							<UserBadge />
						</Card>

						<ThemeContext.Provider value='dark'>
							<Card title='Nested override (theme=dark, static)'>
								<ThemedLabel />
								<UserBadge />
							</Card>
						</ThemeContext.Provider>
					</UserContext.Provider>
				</ThemeContext.Provider>

				<Card title='No provider (uses defaults)'>
					<ThemedLabel />
					<UserBadge />
				</Card>
			</section>
		</div>
	)
}

export default ContextProviderShowcase
