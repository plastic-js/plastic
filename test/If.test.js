import {
	afterEach, beforeEach, describe, expect, it,
} from 'vitest'
import { signal } from '../jsx-runtime.js'
import If from '../components/If.jsx'
import Label from '../components/Label.jsx'

describe('If Component', ()=> {
	let container

	beforeEach(()=> {
		container = document.createElement('div')
		document.body.appendChild(container)
	})

	afterEach(()=> {
		document.body.removeChild(container)
	})

	it('should render children when condition is true', ()=> {
		const show = signal(true)
		const element = (
			<If when={show}>
				<Label text='Visible' />
			</If>
		)

		container.appendChild(element)

		// 给 DOM 一点时间来渲染
		setTimeout(()=> {
			const label = container.querySelector('label')
			expect(label).toBeTruthy()
			expect(label.textContent).toBe('Visible')
		}, 0)
	})

	it('should not render children when condition is false', ()=> {
		const show = signal(false)
		const element = (
			<If when={show}>
				<Label text='Hidden' />
			</If>
		)

		container.appendChild(element)

		setTimeout(()=> {
			const label = container.querySelector('label')
			expect(label).toBeNull()
		}, 0)
	})

	it('should reactively show/hide children when condition changes', (done)=> {
		const show = signal(true)
		const element = (
			<If when={show}>
				<Label text='Toggle' />
			</If>
		)

		container.appendChild(element)

		setTimeout(()=> {
			// Initially should be visible
			let label = container.querySelector('label')
			expect(label).toBeTruthy()

			// Hide it
			show(false)

			setTimeout(()=> {
				label = container.querySelector('label')
				expect(label).toBeNull()

				// Show it again
				show(true)

				setTimeout(()=> {
					label = container.querySelector('label')
					expect(label).toBeTruthy()
					done()
				}, 0)
			}, 0)
		}, 0)
	})
})
