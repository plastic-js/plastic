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
