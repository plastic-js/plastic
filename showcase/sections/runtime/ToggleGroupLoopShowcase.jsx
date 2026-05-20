import { css, cx } from '@emotion/css'
import { Loop, createComputed, createSignal } from '@plastic-js/plastic'

const options = [
	{ value: 'left', label: 'Left' },
	{ value: 'center', label: 'Center' },
	{ value: 'right', label: 'Right' },
	{ value: 'justify', label: 'Justify' },
]

const groupClass = css({
	display: 'inline-flex',
	padding: '4px',
	borderRadius: '10px',
	background: '#f1f5f9',
	border: '1px solid #cbd5e1',
	marginTop: '12px',
	gap: '4px',
})

const itemClass = css({
	padding: '8px 14px',
	border: 'none',
	borderRadius: '6px',
	background: 'transparent',
	color: '#334155',
	cursor: 'pointer',
	fontWeight: 500,
	transition: 'background 120ms ease, color 120ms ease',
	'&:hover': {
		background: '#e2e8f0',
	},
})

const activeClass = css({
	background: '#6366f1',
	color: '#ffffff',
	'&:hover': {
		background: '#6366f1',
	},
})

const ToggleGroupLoopShowcase = ()=> {
	const selected = createSignal('center')

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Toggle group with Loop</h1>
			</header>
			<section className='feature-card'>
				<div className='checklist'>
					<p>
						Selected:
						<strong>
							{createComputed(()=> selected())}
						</strong>
					</p>
					<p>Click an option to toggle. Loop keys each button by its value.</p>
				</div>
				<div className={groupClass} role='group'>
					<Loop each={options}>
						{(option)=> (
							<button
								aria-pressed={createComputed(()=> selected() === option.value)}
								className={createComputed(()=> cx(itemClass, selected() === option.value && activeClass))}
								onClick={()=> selected(option.value)}
								type='button'
							>
								{option.label}
							</button>
						)}
					</Loop>
				</div>
			</section>
		</div>
	)
}

export default ToggleGroupLoopShowcase
