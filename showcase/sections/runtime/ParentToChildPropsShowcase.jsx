import { createComputed, createSignal, createTree } from '@plastic-js/plastic'

const Button = ({ onClick, children })=> (
	<button onClick={onClick} type='button'>
		{children}
	</button>
)

const ChildProfileCard = ({
	title, name, level, note, profile,
})=> (
	<div className='checklist'>
		<p>
			<strong>
				{title}
			</strong>
		</p>
		<p>
			Name:
			<span>
				{name}
			</span>
		</p>
		<p>
			Level:
			<span>
				{level}
			</span>
		</p>
		<p>
			{note}
		</p>
		<p>
			Role:
			<span>
				{profile.role}
			</span>
		</p>
		<p>
			Streak days:
			<span>
				{profile.streak}
			</span>
		</p>
	</div>
)

const ParentToChildPropsShowcase = ()=> {
	const profileName = createSignal('Ava')
	const profileLevel = createSignal(1)
	const profileNote = createComputed(()=> profileLevel() >= 3 ? 'Ready for advanced tasks' : 'Keep building fundamentals')
	const profileTree = createTree({
		role: 'Builder',
		streak: 3,
	})

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Parent to child props</h1>
			</header>
			<section className='feature-card'>
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
					<Button onClick={()=> { profileTree.role = profileTree.role === 'Builder' ? 'Architect' : 'Builder' }}>Toggle role (tree)</Button>
					<Button onClick={()=> { profileTree.streak += 1 }}>+1 streak (tree)</Button>
					<Button onClick={()=> profileLevel(1)}>Reset level</Button>
				</div>
			</section>
		</div>
	)
}

export default ParentToChildPropsShowcase
