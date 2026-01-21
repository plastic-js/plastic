import { computed, signal } from './jsx-runtime.js'
import Label from './components/Label.jsx'
import If from './components/If.jsx'
import './global.css'

// 创建响应式状态
const count = signal(0)
const doubleCount = computed(()=> count() * 2)
const level = computed(()=> {
	return count() > 5 ? 'High!' : count() < -5 ? 'Low!' : 'Normal'
})

const App = ()=> {
	const showLabel = signal(true)
	const handleClick = ()=> {
		showLabel(!showLabel())
	}
	return (
		<div className='container'>
			{/* // 永遠不會切換，沒關係。就用這種效果，因為我們不反對tenary這種語法 */}
			{ showLabel && <Label text='This is a label component--foo' /> }
			<If when={showLabel}>
				<Label text='This is a label component--bar' />
			</If>
			<div className='counter'>
				<p>
					Count:
					{ count}
				</p>
				<p>
					Double Count:
					{ doubleCount }
				</p>
			</div>
			<div className='buttons'>
				<button
					onClick={()=> count(count() + 1)}
				>
					Increment
				</button>
				<button
					onClick={()=> count(count() - 1)}
				>
					Decrement
				</button>
				<button
					onClick={()=> count(0)}
				>
					Reset
				</button>
				<button
					onClick={handleClick}
				>
					Toggle Label
				</button>
			</div>
			<div className='info'>
				<p>
					Status:
					{level}
				</p>
			</div>
		</div>

	)
}
// 渲染到DOM
document.body.appendChild(App())
