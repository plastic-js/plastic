import {
	computed, effect, isComputed, isSignal, signal,
} from 'alien-signals'

const isReactive = value=> isSignal(value) || isComputed(value)

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
					if (typeof child === 'string'){
						const textNode = document.createTextNode(child)
						element.appendChild(textNode)
						continue
					}
					// // Signal as a function 
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
					if (child instanceof HTMLElement){
						element.appendChild(child)
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
		const componentElement = tag({ ...props, children })
		return componentElement
	}
}

const runMount = (element)=> {}
const runUnmount = (element)=> {}
const runCleanup = (element)=> {}
const onMount = (callback)=> {}
const onUnmount = (callback)=> {}
export {
	signal, computed, effect, h, runCleanup, runMount, runUnmount, onMount, onUnmount,
}

export const jsx = h
export const jsxs = h
