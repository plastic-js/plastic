import {
	afterEach, beforeEach, describe, expect, it,
} from 'vitest'
import { screen } from '@testing-library/dom'
import Label from '../components/Label.jsx'

describe('Label Component', ()=> {
	let container

	beforeEach(()=> {
		// 创建一个 DOM 容器来挂载组件
		container = document.createElement('div')
		document.body.appendChild(container)
	})

	afterEach(()=> {
		// 清理 DOM
		document.body.removeChild(container)
	})

	it('应该渲染 label 元素', ()=> {
		const element = Label({ text: 'Test Label' })
		container.appendChild(element)

		const labelElement = container.querySelector('label')
		expect(labelElement).toBeTruthy()
	})

	it('应该在 label 中显示传入的文本', ()=> {
		const testText = 'This is a test label'
		const element = Label({ text: testText })
		container.appendChild(element)

		expect(screen.getByText(testText)).toBeInTheDocument()
	})

	it('应该能处理不同的文本内容', ()=> {
		const texts = [
			'First label',
			'Second label with more text',
			'标签文本测试',
		]

		texts.forEach((text)=> {
			const container2 = document.createElement('div')
			document.body.appendChild(container2)

			const element = Label({ text })
			container2.appendChild(element)

			expect(screen.getByText(text)).toBeInTheDocument()

			document.body.removeChild(container2)
		})
	})

	it('label 元素应该包含正确的文本节点', ()=> {
		const testText = 'Direct text test'
		const element = Label({ text: testText })
		container.appendChild(element)

		const labelElement = container.querySelector('label')
		expect(labelElement.textContent).toBe(testText)
	})

	it('应该能渲染空的文本', ()=> {
		const element = Label({ text: '' })
		container.appendChild(element)

		const labelElement = container.querySelector('label')
		expect(labelElement).toBeTruthy()
		expect(labelElement.textContent).toBe('')
	})
})
