import {
	Either, Loop, True, createComputed, createSignal,
} from '@plastic-js/plastic'

const Button = ({ onClick, children })=> (
	<button onClick={onClick} type='button'>
		{children}
	</button>
)

const EventBindingShowcase = ()=> {
	const inputValue = createSignal('')
	const inputHistory = createSignal([])
	const hoverCount = createSignal(0)

	const handleInputChange = (event)=> {
		inputValue(event.target.value)
	}

	const handleInputBlur = ()=> {
		if (inputValue().trim()){
			inputHistory([...inputHistory(), inputValue()])
			inputValue('')
		}
	}

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Event binding</h1>
			</header>
			<section className='feature-card'>
				<p className='feature-copy'>
					The runtime supports
					<code>onXxx</code>
					{' '}
					event props that map to
					<code>addEventListener</code>
					.
				</p>
				<div className='checklist'>
					<p>
						Input value:
						<strong>
							{inputValue() || '(empty)'}
						</strong>
					</p>
					<p>
						Saved entries:
						<strong>
							{inputHistory().length}
						</strong>
					</p>
					<p>
						Hover count:
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
					<Button onClick={()=> inputHistory([])}>Clear history</Button>
				</div>
				<div
					onMouseEnter={()=> hoverCount(hoverCount() + 1)}
					style={{
						padding: '12px', background: '#f0f0f0', borderRadius: '4px', marginBottom: '12px',
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
		</div>
	)
}

export default EventBindingShowcase
