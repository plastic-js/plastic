import {
	computed, effect, isComputed, isSignal, signal,
} from 'alien-signals'

// const isReactive = value=> isSignal(value) || isComputed(value)

const h = (tag, props = {}, ...children)=> {
	if (typeof tag !== 'string'){
		return null
	}
	// 讀取普通的html tag 比如 'div', 'span'
	const element = document.createElement(tag)

	for (const [key, value] of Object.entries(props)){
		if (key === 'children'){
			if (typeof value === 'string'){
				const textNode = document.createTextNode(value)
				element.appendChild(textNode)
				continue
			}
			if (value instanceof HTMLElement){
				element.appendChild(value)
			}
		}
	}
	return element
}

const runMount = (element)=> {}
const runUnmount = (element)=> {}
const runCleanup = (element)=> {}
export {
	signal, computed, effect, h, runCleanup, runMount, runUnmount,
}

export const jsx = h
export const jsxs = h
