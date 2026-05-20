import { Either, True, createTree } from '@plastic-js/plastic'

const FormHandlingShowcase = ()=> {
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

	return (
		<div className='container'>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Form handling with tree reactivity</h1>
			</header>
			<section className='feature-card'>
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
						<button type='submit'>Submit</button>
					</div>
					<Either condition={()=> formData.submitted}>
						<True>
							<div style={{
								padding: '12px', background: '#e8f5e9', borderLeft: '3px solid #4caf50', borderRadius: '4px',
							}}
							>
								Form submitted successfully! (auto-clears in 2 seconds)
							</div>
						</True>
					</Either>
				</form>
			</section>
		</div>
	)
}

export default FormHandlingShowcase
