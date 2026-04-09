import {
	computed, effect, isComputed, isSignal, signal,
} from 'alien-signals'

const isReactive = value=> isSignal(value) || isComputed(value)
const pendingEffects = []
let currentComponentContext = null
const allowedEvents = new Set([
	'click',
	'dblclick',
	'mousedown',
	'mouseup',
	'mouseover',
	'mouseout',
	'mousemove',
	'mouseenter',
	'mouseleave',
	'keydown',
	'keyup',
	'keypress',
	'input',
	'change',
	'submit',
	'focus',
	'blur',
])

const allowedLifecycleEvents = new Set([
	'mount',
	'unmount',
])

const node2Element = (node)=> {
	if (node === null || node === undefined){
		console.error('null node', 1)
		return document.createComment('null')
	}
	if (typeof node === 'string' || typeof node === 'number'){
		return document.createTextNode(node)
	}
	if (node instanceof HTMLElement || node instanceof Text || node instanceof Comment){
		return node
	}
	console.error('暫不處理', 2)
	return document.createComment('null')
}

const h = (tag, props = {}, ...children)=> {
	if (typeof tag === 'string'){
		const element = document.createElement(tag)

		for (const [key, value] of Object.entries(props)){
			if (key === 'children'){
				let childrenFromProps = value
				if (!Array.isArray(value)){
					childrenFromProps = [value]
				}
				for (const child of childrenFromProps){
					// Signal as a function 
					if (isReactive(child)){
						const childValue = child()
						// text node
						if (typeof childValue === 'string' || typeof childValue === 'number'){
							const textNode = document.createTextNode(childValue)
							element.appendChild(textNode)
							effect(()=> {
								textNode.textContent = child()
							})
						}
						// HTMLElement,先不處理
						continue
					}
					// normal node
					const result = node2Element(child)
					element.appendChild(result)

					// array from <> </> fragments, or from If component
					if (Array.isArray(child)){
						for (const nestedChild of child){
							let arr = nestedChild
							if (!Array.isArray(nestedChild)){
								arr = [nestedChild]
							}
							for (const deepChild of arr){
								const deepChildElement = node2Element(deepChild)
								element.appendChild(deepChildElement)
							}
						}
						continue
					}
				}
				continue
			}
			if (key.startsWith('on')){
				const eventName = key.slice(2)
				if(!eventName){
					continue
				}
				if(eventName[0] !== eventName[0].toUpperCase()){
					continue
				}
				if (allowedEvents.has(eventName.toLowerCase())){
					const eventType = eventName.toLowerCase()
					// in the future, we need to remove the listeners when unmounting
					element.addEventListener(eventType, value)
					continue
				}
				if (allowedLifecycleEvents.has(eventName.toLowerCase())){
					// handle lifecycle events later
					continue
				}
			}
		}
		return element
	}
	// function components
	if (typeof tag === 'function'){
		const prev = currentComponentContext
		currentComponentContext = {
			mounts: [],
			unmounts: [],
		}
		const componentElement = tag({ ...props })
		currentComponentContext = prev

		// Handle computed/signal values from components (e.g., If component)
		if (isReactive(componentElement)){
			// 第一步，生成兩個comment節點
			// 第二步，計算出comment之間的部分
			// 第三步，effect（本來應該異步，但是現在只有同步API），判斷是否已經加入到父節點，然後再更新comment之間的內容
			// comment和中間的內容，作為一個數組，一起被return 
			// debugger
			const id = Date.now()
			const anchorStart = document.createComment('computed-anchor-start' + id)
			const anchorEnd = document.createComment('computed-anchor-end' + id)

			const figureoutRealElement = (value)=> {
				if (!Array.isArray(value)){
					return [node2Element(value)]
				}
				return value.map((item)=> {
					return node2Element(item)
				})
			}

			const updateRealPart = (value)=> {
				if (!anchorEnd.parentNode){
					// wait for the two anchors to be inserted
					return null
				}
				// remove all nodes between the two anchors
				let node = anchorStart.nextSibling
				while (node && node !== anchorEnd){
					const nextNode = node.nextSibling
					node.remove()
					node = nextNode
				}

				const nodesToInsert = figureoutRealElement(value)
				// 封裝一個函數，直接插入數組到DOM
				for (const node of nodesToInsert){
					anchorEnd.parentNode?.insertBefore(node, anchorEnd)
				}
			}

			// renderValue(componentElement())
			effect(()=> {
				console.log(222222, componentElement())
				updateRealPart(componentElement())
			})
			debugger
			return [
				anchorStart,
				...figureoutRealElement(componentElement()),
				anchorEnd,
			]
		}

		return componentElement
	}
}

const runCleanup = (element)=> {
	if (currentComponentContext){
		for (const unmount of currentComponentContext.unmounts){
			unmount()
		}
	}
}
const onMount = (fn)=> {
	// currentComponentContext.mounts.push(fn)
	pendingEffects.push(fn)
}
const onUnmount = (fn)=> {
	if (currentComponentContext){
		currentComponentContext.unmounts.push(fn)
	}
}
const renderApp = (rootElement, appElement)=> {
	rootElement.appendChild(appElement)
	// 倒序執行 mount 回調
	while (pendingEffects.length){
		const effectFn = pendingEffects.pop()
		effectFn()
	}
}
export {
	signal, computed, effect, h, runCleanup, onMount, onUnmount, renderApp,
}

export const jsx = h
export const jsxs = h
