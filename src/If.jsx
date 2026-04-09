import { computed } from './jsx-runtime.js'

// children 支援函式 (lazy render) 或 React-like 節點
// const If = ({ when, children })=> { 不可解構
const If = (props)=> {
	// 當 when 為 signal (function) 時會自動訂閱
	return computed(()=> {
		const cond = typeof props.when === 'function' ? props.when() : props.when
		// return null
		if (!cond){ return <div>佔位符</div> }
		return typeof props.children === 'function' ? props.children() : props.children
	})
}

export default If
