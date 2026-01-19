import { computed, signal } from './jsx-runtime.js'
import Label from './components/Label.jsx'
import './global.css'

// 创建响应式状态
const count = signal(0)
const doubleCount = computed(()=> count() * 2)
const level = computed(()=> {
	return count() > 5 ? 'High!' : count() < -5 ? 'Low!' : 'Normal'
})

// eslint-disable-next-line @stylistic/js/no-extra-parens
const App = ()=> (
	<div className='container'>
		<Label text='This is a label component--foo' />
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
		</div>
		<div className='info'>
			<p>
				Status:
				{level}
			</p>
		</div>
	</div>

)
// 渲染到DOM
document.body.appendChild(App())
