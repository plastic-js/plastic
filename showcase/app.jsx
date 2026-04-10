import {
	computed,
	renderApp,
	signal,
} from '../src/jsx-runtime.js'
import './global.css'

const reactiveCount = signal(0)
const reactiveLabel = computed(()=> `Signal count: ${reactiveCount()}`)
const reactiveDouble = computed(()=> `Double count: ${reactiveCount() * 2}`)

const handleReactiveClick = ()=> {
	reactiveCount(reactiveCount() + 1)
}

const app = (
	<div className='container'>
		<h1>JSX Runtime Showcase</h1>
		<section className='feature-card'>
			<h2>Reactive text nodes</h2>
			<p>These text children are signals, so the same Text nodes update in place.</p>
			<p>
				{reactiveLabel}
			</p>
			<p>
				{reactiveDouble}
			</p>
			<button onClick={handleReactiveClick} type='button'>Update reactive text</button>
		</section>
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
	</div>
)

// 渲染到DOM
renderApp(document.body.querySelector('.app'), app)
