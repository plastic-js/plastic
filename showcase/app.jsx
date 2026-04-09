import { computed, onMount, renderApp, signal } from '../src/jsx-runtime.js'
import Label from '../showcase/components/Label.jsx'
import If from '../src/If.jsx'
import './global.css'

// 创建响应式状态
const count = signal(0)
const doubleCount = computed(()=> count() * 2)
const level = computed(()=> {
	return count() > 5 ? 'High!' : count() < -5 ? 'Low!' : 'Normal'
})

const App = ()=> {
	const showLabel = signal(true)
	onMount(()=> {
		console.log('App mounted')
	})
	const handleClick = ()=> {
		showLabel(!showLabel())
		count(count() + 1)
	}
	return (
		<div className='container'>
			<span onClick={handleClick}>click on me...</span>
			<p>
				{count }
			</p>
			<Label text={level} />
			<If when={showLabel}>
				<p>The label is shown</p>
			</If>
		</div>

	)
}
// 渲染到DOM
renderApp(document.body, <App />)
