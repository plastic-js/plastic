import {
	renderApp,
} from '../src/jsx-runtime.js'
import './global.css'

let clickCount = 0
const counterLabel = document.createElement('p')
counterLabel.textContent = `Button clicked: ${clickCount} times`

const handleClick = ()=> {
	clickCount += 1
	counterLabel.textContent = `Button clicked: ${clickCount} times`
}

const app = (
	<div className='container'>
		<h1>JSX Runtime Showcase</h1>
		<span>Static element rendering works.</span>
		<p>Static text children render in order.</p>
		<p>Event binding with onClick works.</p>
		<button onClick={handleClick} type='button'>Click me</button>
		<section className='feature-card'>
			<h2>Boolean attributes</h2>
			<p>Props like disabled and checked now map to real DOM boolean attributes.</p>
			<div className='boolean-demo'>
				<button disabled type='button'>Disabled button</button>
				<label className='checkbox-row'>
					<input checked readOnly type='checkbox' />
					<span>Checked checkbox</span>
				</label>
				<label className='checkbox-row'>
					<input type='checkbox' />
					<span>Unchecked checkbox</span>
				</label>
			</div>
		</section>
		<div
			className='parent'
			style={{
				border: '1px solid black',
				padding: '8px',
				marginTop: '8px',
			}}
		>
			<div>div.firstchild</div>
			<div>div.secondchild</div>
		</div>
		{counterLabel}
	</div>
)

// 渲染到DOM
renderApp(document.body.querySelector('.app'), app)
