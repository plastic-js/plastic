import {
	computed, effect, isComputed, isSignal, signal,
} from 'alien-signals'

/**
 * 安全获取可能是 signal 的值
 */
function getSignalValue(value){
	try {
		return isSignal(value) ? value() : value
	} catch {
		return null
	}
}

/**
 * 转换值为字符串
 */
function toString(value){
	return String(value ?? '')
}

/**
 * Enhanced hyperscript function with reactivity support
 * @param {string|Function} tag - HTML element tag name or component function
 * @param {Object} props - Element properties and event handlers
 * @param {...any} children - Child elements or text
 * @returns {Element|*} DOM element or component result
 */
function h(tag, props = {}, ...children){
	// 如果是组件函数，直接调用
	if (typeof tag === 'function'){
		return tag(props, ...children)
	}

	const element = document.createElement(tag)

	// 合并 props.children 和参数 children
	const allChildren = mergeChildren(props, children)

	// 分离并处理属性
	const {
		eventListeners, dynamicProps, staticProps,
	} = separateProps(props)

	// 应用静态属性
	applyStaticProps(element, staticProps)

	// 绑定事件监听器
	attachEventListeners(element, eventListeners)

	// 设置动态属性的响应式更新
	setupDynamicProps(element, dynamicProps)

	// 处理子元素
	appendChildren(element, allChildren)

	return element
}

/**
 * 合并 props.children 和参数中的 children
 */
function mergeChildren(props, paramChildren){
	const propsChildren = props?.children
	if (!propsChildren){ return paramChildren }

	const childArray = Array.isArray(propsChildren) ? propsChildren : [propsChildren]
	return [...childArray, ...paramChildren]
}

/**
 * 将 props 分离为事件监听器、动态属性和静态属性
 */
function separateProps(props){
	const eventListeners = {}
	const dynamicProps = {}
	const staticProps = {}

	Object.entries(props || {}).forEach(([key, value])=> {
		if (key === 'children'){ return }

		if (key.startsWith('on') && typeof value === 'function'){
			const eventName = key.slice(2).toLowerCase()
			eventListeners[eventName] = value
		} else if (isSignal(value)){
			dynamicProps[key] = value
		} else {
			staticProps[key] = value
		}
	})

	return {
		eventListeners, dynamicProps, staticProps,
	}
}

/**
 * 应用静态属性到元素
 */
function applyStaticProps(element, props){
	Object.entries(props).forEach(([key, value])=> {
		if (value != null){
			element.setAttribute(key, toString(value))
		}
	})
}

/**
 * 为元素绑定事件监听器
 */
function attachEventListeners(element, listeners){
	Object.entries(listeners).forEach(([eventName, handler])=> {
		element.addEventListener(eventName, handler)
	})
}

/**
 * 为动态属性设置响应式更新
 */
function setupDynamicProps(element, props){
	Object.entries(props).forEach(([key, getter])=> {
		// 设置初始值
		const initialValue = getSignalValue(getter)
		if (initialValue != null){
			element.setAttribute(key, toString(initialValue))
		}

		// 创建响应式更新
		effect(()=> {
			const value = getSignalValue(getter)
			if (value != null){
				element.setAttribute(key, toString(value))
			} else {
				element.removeAttribute(key)
			}
		})
	})
}

/**
 * 递归处理并附加子元素到父元素
 */
function appendChildren(parent, children){
	children.forEach((child)=> {
		appendChild(parent, child)
	})
}

/**
 * 附加单个子元素到父元素
 */
function appendChild(parent, child){
	// DOM 节点
	if (child instanceof Node){
		parent.appendChild(child)
		return
	}

	// 数组（递归处理）
	if (Array.isArray(child)){
		appendChildren(parent, child)
		return
	}

	// Signal（响应式值）
	if (isSignal(child)){
		const value = getSignalValue(child)
		appendChild(parent, value)

		// 为文本类型的 signal 创建响应式更新
		const textNode = document.createTextNode('')
		parent.appendChild(textNode)

		effect(()=> {
			const newValue = getSignalValue(child)
			if (newValue != null){
				textNode.textContent = toString(newValue)
			}
		})
		return
	}

	// 基本类型（字符串、数字、布尔值）
	if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean'){
		parent.appendChild(document.createTextNode(toString(child)))
		return
	}

	// null 和 undefined 忽略
	if (child == null){
		return
	}

	// 其他类型警告
	console.warn('Unexpected child type:', child)
	parent.appendChild(document.createTextNode(toString(child)))
}

export {
	signal, computed, effect, h,
}
export const jsx = h
export const jsxs = h
