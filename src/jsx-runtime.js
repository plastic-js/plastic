import {
	computed, effect, isComputed, isSignal, signal,
} from 'alien-signals'

// const isReactive = value=> isSignal(value) || isComputed(value)

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

const h = (tag, props = {}, ...children)=> {
	if (typeof tag !== 'string'){
		return null
	}
	// 讀取普通的html tag 比如 'div', 'span'
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
				if (child instanceof HTMLElement){
					element.appendChild(child)
				}
			}
			continue
		}
		if (key.startsWith('on')){
			const eventName = key.slice(2)
			if(eventName){
				if(eventName[0] === eventName[0].toUpperCase()){
					if (allowedEvents.has(eventName.toLowerCase())){
						const eventType = eventName.toLowerCase()
						// in the future, we need to remove the listeners when unmounting
						element.addEventListener(eventType, value)
					}
					continue
				}
			}
		}
	}
	return element
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
