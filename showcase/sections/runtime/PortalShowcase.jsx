import {
	Either, Portal, True, createComputed, createSignal,
} from '@plastic-js/plastic'

const modalStyles = `
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}
.modal-box {
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    min-width: 360px;
    max-width: 480px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}
.modal-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}
.modal-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.08);
    font-weight: 700;
    font-size: 13px;
    flex-shrink: 0;
}
.modal-header strong {
    flex: 1;
    font-size: 16px;
}
.modal-close {
    margin-left: auto;
    background: var(--ink);
    color: #fff;
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.modal-body {
    margin: 0 0 20px;
    color: var(--muted);
    line-height: 1.6;
}
.modal-body code {
    background: rgba(0, 0, 0, 0.06);
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 0.88em;
    font-family: monospace;
}
`

const Button = ({ onClick, children })=> (
	<button onClick={onClick} type='button'>
		{children}
	</button>
)

const Modal = ({ onClose, theme })=> {
	const themeMap = {
		info: {
			bg: '#e8f4fd', border: '#2196f3', icon: 'i', label: 'Info',
		},
		success: {
			bg: '#e8f5e9', border: '#4caf50', icon: 'ok', label: 'Success',
		},
		warning: {
			bg: '#fff8e1', border: '#ff9800', icon: '!', label: 'Warning',
		},
	}
	const style = createComputed(()=> themeMap[theme()] ?? themeMap.info)

	return (
		<div className='modal-overlay' onClick={onClose}>
			<div className='modal-box' onClick={e=> e.stopPropagation()} style={createComputed(()=> ({ borderTop: `4px solid ${style().border}`, background: style().bg }))}>
				<div className='modal-header'>
					<span className='modal-icon'>
						{createComputed(()=> style().icon)}
					</span>
					<strong>
						Portal modal -
						{createComputed(()=> style().label)}
					</strong>
					<button className='modal-close' onClick={onClose} type='button'>x</button>
				</div>
				<p className='modal-body'>
					This dialog is rendered via
					<code>&lt;Portal&gt;</code>
					{' '}
					into
					<code>document.body</code>
					.
				</p>
				<div className='button-row'>
					<Button onClick={()=> theme('info')}>Info</Button>
					<Button onClick={()=> theme('success')}>Success</Button>
					<Button onClick={()=> theme('warning')}>Warning</Button>
					<Button onClick={onClose}>Close</Button>
				</div>
			</div>
		</div>
	)
}

const PortalShowcase = ()=> {
	const portalOpen = createSignal(false)
	const portalTheme = createSignal('info')

	return (
		<div className='container'>
			<style>{modalStyles}</style>
			<header className='hero'>
				<p className='eyebrow'>Runtime Section</p>
				<h1>Portal</h1>
			</header>
			<section className='feature-card'>
				<div className='checklist'>
					<p>
						Modal:
						<strong>
							{createComputed(()=> portalOpen() ? 'open' : 'closed')}
						</strong>
					</p>
					<p>
						Current theme:
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
}

export default PortalShowcase
