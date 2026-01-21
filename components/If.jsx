import { computed } from '../jsx-runtime.js'

// children 支援函式 (lazy render) 或 React-like 節點
const If = ({ when, children })=> {
	// 當 when 為 signal (function) 時會自動訂閱
	return computed(()=> {
		const cond = typeof when === 'function' ? when() : when
		// return null
		if (!cond){ return <div /> }
		return typeof children === 'function' ? children() : children
	})
}

export default If
