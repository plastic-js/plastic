import {
	renderApp,
} from '../src/jsx-runtime.js'
import './global.css'

const app = (
	<div className='container'>
		<h1>JSX Runtime Showcase</h1>
		<span>Static element rendering works.</span>
		<p>Static text children render in order.</p>
		<p>Event binding demo removed.</p>
		<div
			className='parent' style='border: 1px solid black; padding: 8px; margin-top: 8px;'
		>
			<div>div.firstchild</div>
			<div>div.secondchild</div>
		</div>
	</div>
)

// 渲染到DOM
renderApp(document.body.querySelector('.app'), app)
