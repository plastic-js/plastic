import {
	computed, effect, isComputed, isSignal, signal,
} from 'alien-signals'

const isReactive = value=> isSignal(value) || isComputed(value)
/**
 * 安全获取可能是 signal 的值
 */
const getReactiveValue = (value)=> {
	try {
		return isReactive(value) ? value() : value
	} catch {
		return null
	}
}

/**
 * 转换值为字符串
 */
const toString = (value)=> {
	return String(value ?? '')
}

/**
 * Enhanced hyperscript function with reactivity support
 * @param {string|Function} tag - HTML element tag name or component function
 * @param {Object} props - Element properties and event handlers
 * @param {...any} children - Child elements or text
 * @returns {Element|*} DOM element or component result
 */
const h = (tag, props = {}, ...children)=> {
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
const mergeChildren = (props, paramChildren)=> {
	const propsChildren = props?.children
	if (!propsChildren){ return paramChildren }

	const childArray = Array.isArray(propsChildren) ? propsChildren : [propsChildren]
	return [...childArray, ...paramChildren]
}

/**
 * 将 props 分离为事件监听器、动态属性和静态属性
 */
const separateProps = (props)=> {
	const eventListeners = {}
	const dynamicProps = {}
	const staticProps = {}

	Object.entries(props || {}).forEach(([key, value])=> {
		if (key === 'children'){ return }

		if (key.startsWith('on') && typeof value === 'function'){
			const eventName = key.slice(2).toLowerCase()
			eventListeners[eventName] = value
		} else if (isReactive(value)){
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
const applyStaticProps = (element, props)=> {
	Object.entries(props).forEach(([key, value])=> {
		if (value != null){
			element.setAttribute(key, toString(value))
		}
	})
}

/**
 * 为元素绑定事件监听器
 */
const attachEventListeners = (element, listeners)=> {
	Object.entries(listeners).forEach(([eventName, handler])=> {
		element.addEventListener(eventName, handler)
	})
}

/**
 * 为动态属性设置响应式更新
 */
const setupDynamicProps = (element, props)=> {
	Object.entries(props).forEach(([key, getter])=> {
		// 设置初始值
		const initialValue = getReactiveValue(getter)
		if (initialValue != null){
			element.setAttribute(key, toString(initialValue))
		}

		// 创建响应式更新
		effect(()=> {
			const value = getReactiveValue(getter)
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
const appendChildren = (parent, children)=> {
	children.forEach((child)=> {
		appendChild(parent, child)
	})
}

/**
 * 附加单个子元素到父元素
 */
const appendChild = (parent, child)=> {
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

	// Signal 或 Computed（响应式值）
	if (isReactive(child)){
		// 为文本类型的 signal/computed 创建响应式更新
		const textNode = document.createTextNode('')
		parent.appendChild(textNode)

		effect(()=> {
			const newValue = getReactiveValue(child)
			if (newValue != null){
				textNode.textContent = toString(newValue)
			}
		})
		return
	}

	// 普通函数（执行函数并渲染其返回值）
	if (typeof child === 'function'){
		// 创建一个占位节点用于动态内容替换
		const placeholder = document.createComment('dynamic')
		parent.appendChild(placeholder)

		let currentNodes = []

		effect(()=> {
			// 执行函数获取结果
			const result = child()

			// 清除之前的节点
			currentNodes.forEach((node)=> {
				if (node.parentNode === parent){
					parent.removeChild(node)
				}
			})
			currentNodes = []

			// 处理新结果
			if (result == null){
				return
			}

			// 如果结果是响应式值，获取其当前值
			const actualValue = isReactive(result) ? getReactiveValue(result) : result

			// 创建临时容器来收集新节点
			const tempContainer = document.createElement('div')
			appendChild(tempContainer, actualValue)

			// 将新节点插入到占位符之前
			currentNodes = [...tempContainer.childNodes]
			currentNodes.forEach((node)=> {
				parent.insertBefore(node, placeholder)
			})
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
