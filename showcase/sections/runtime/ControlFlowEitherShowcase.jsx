import {
	Either, False, True, createComputed, createSignal,
} from '@plastic-js/plastic'

const Button = ({ onClick, children })=> (
	<button onClick={onClick} type='button'>
		{children}
	</button>
)

const ControlFlowEitherShowcase = ()=> {
	const ifVisible = createSignal(false)
	const ifPlan = createSignal('starter')

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Control flow with Either</h1>
			</header>
			<section className='feature-card'>
				<div className='checklist'>
					<p>
						Active branch:
						<strong>
							{createComputed(()=> ifVisible() ? 'True' : 'False')}
						</strong>
					</p>
					<p>
						Selected plan:
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
		</div>
	)
}

export default ControlFlowEitherShowcase
