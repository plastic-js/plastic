import { computed, runMount, signal } from '../src/jsx-runtime.js'
// import Label from '../showcase/components/Label.jsx'
// import If from '../src/If.jsx'
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
		window.alert(22)
		showLabel(!showLabel())
	}
	return (
		<div className='container'>
			<span onClick={handleClick}>2222</span>
		</div>

	)
}
// 渲染到DOM
const appElement = App()
document.body.appendChild(appElement)
// 触发 mount 事件以启动响应式效果
// runMount(appElement)
