// @vitest-environment jsdom

import {
	afterEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'
import {
	Link,
	Outlet,
	Route,
	Router,
	h,
	renderApp,
} from '../src/index.js'

describe('router', ()=> {
	afterEach(()=> {
		document.body.innerHTML = ''
		window.history.replaceState(null, '', '/')
	})

	it('renders the matching route and reacts to navigation', ()=> {
		window.history.replaceState(null, '', '/about')
		const container = document.createElement('div')
		document.body.appendChild(container)
		const App = ()=> h(Router, null, h(Route, {
			path: '/',
		}, h('p', null, 'Home')), h(Route, {
			path: '/about',
		}, h('p', null, 'About')))

		renderApp(container, h(App))
		expect(container.textContent).toBe('About')

		window.history.replaceState(null, '', '/')
		window.dispatchEvent(new PopStateEvent('popstate'))
		expect(container.textContent).toBe('Home')
	})

	it('intercepts Link clicks and updates the active route', ()=> {
		window.history.replaceState(null, '', '/')
		const container = document.createElement('div')
		document.body.appendChild(container)
		const App = ()=> h(Router, null, h('nav', null, h(Link, {
			to: '/about',
		}, 'About')), h(Route, {
			path: '/about',
		}, h('p', null, 'About page')))

		renderApp(container, h(App))
		const link = container.querySelector('a')

		expect(link.getAttribute('href')).toBe('/about')
		link.dispatchEvent(new MouseEvent('click', {
			bubbles: true,
			button: 0,
			cancelable: true,
		}))

		expect(window.location.pathname).toBe('/about')
		expect(container.textContent).toContain('About page')
	})

	it('renders the matching route and reacts to popstate', ()=> {
		window.history.replaceState(null, '', '/')
		const container = document.createElement('div')
		document.body.appendChild(container)
		const App = ()=> h(Router, null, h(Link, {
			to: '/settings',
		}, 'Settings'), h(Route, {
			path: '/',
		}, h('p', null, 'Home')), h(Route, {
			path: '/settings',
		}, h('p', null, 'Settings')))

		renderApp(container, h(App))
		const link = container.querySelector('a')

		expect(link.getAttribute('href')).toBe('/settings')
		expect(container.textContent).toContain('Home')

		window.history.pushState(null, '', '/settings')
		window.dispatchEvent(new PopStateEvent('popstate'))
		expect(container.textContent).toContain('Settings')
		expect(container.textContent).not.toContain('Home')
	})

	it('renders route components lazily and only mounts the active branch', ()=> {
		window.history.replaceState(null, '', '/active')
		const Active = vi.fn(()=> h('p', null, 'Active'))
		const Inactive = vi.fn(()=> h('p', null, 'Inactive'))
		const container = document.createElement('div')
		document.body.appendChild(container)
		const App = ()=> h(Router, null, h(Route, {
			path: '/active',
			component: Active,
		}), h(Route, {
			path: '/inactive',
			component: Inactive,
		}))

		renderApp(container, h(App))
		expect(Active).toHaveBeenCalledTimes(1)
		expect(Inactive).not.toHaveBeenCalled()
		expect(container.textContent).toBe('Active')

		window.history.pushState(null, '', '/inactive')
		window.dispatchEvent(new PopStateEvent('popstate'))
		expect(Inactive).toHaveBeenCalledTimes(1)
		expect(container.textContent).toBe('Inactive')
	})

	describe('nested routes', ()=> {
		it('renders a nested child route via Outlet', ()=> {
			window.history.replaceState(null, '', '/settings/profile')
			const container = document.createElement('div')
			document.body.appendChild(container)

			const Settings = ()=> h('div', null, h('span', null, 'Settings'), h(Outlet, null))
			const Profile = ()=> h('p', null, 'Profile')

			const App = ()=> h(Router, null, h(Route, { path: '/settings', component: Settings }, h(Route, { path: '/profile', component: Profile })))

			renderApp(container, h(App))
			expect(container.textContent).toContain('Settings')
			expect(container.textContent).toContain('Profile')
		})

		it('switches nested child routes on navigation', ()=> {
			window.history.replaceState(null, '', '/settings/profile')
			const container = document.createElement('div')
			document.body.appendChild(container)

			const Settings = ()=> h('div', null, h('span', null, 'Settings'), h(Outlet, null))
			const Profile = ()=> h('p', null, 'Profile')
			const Security = ()=> h('p', null, 'Security')

			const App = ()=> h(Router, null, h(Route, { path: '/settings', component: Settings }, h(Route, { path: '/profile', component: Profile }), h(Route, { path: '/security', component: Security })))

			renderApp(container, h(App))
			expect(container.textContent).toContain('Profile')
			expect(container.textContent).not.toContain('Security')

			window.history.pushState(null, '', '/settings/security')
			window.dispatchEvent(new PopStateEvent('popstate'))
			expect(container.textContent).toContain('Security')
			expect(container.textContent).not.toContain('Profile')
		})

		it('renders parent route at its own path without a child match', ()=> {
			window.history.replaceState(null, '', '/settings')
			const container = document.createElement('div')
			document.body.appendChild(container)

			const Settings = ()=> h('div', null, h('span', null, 'Settings'), h(Outlet, null))
			const Profile = ()=> h('p', null, 'Profile')

			const App = ()=> h(Router, null, h(Route, { path: '/settings', component: Settings }, h(Route, { path: '/profile', component: Profile })))

			renderApp(container, h(App))
			// Parent route matched, no child matched → Outlet renders nothing
			expect(container.textContent).toContain('Settings')
			expect(container.textContent).not.toContain('Profile')
		})

		it('renders nested index routes at the parent path', ()=> {
			window.history.replaceState(null, '', '/settings')
			const container = document.createElement('div')
			document.body.appendChild(container)

			const Settings = ()=> h('div', null, h('span', null, 'Settings'), h(Outlet, null))
			const Overview = ()=> h('p', null, 'Overview')

			const App = ()=> h(Router, null, h(Route, { path: '/settings', component: Settings }, h(Route, { index: true, component: Overview })))

			renderApp(container, h(App))
			expect(container.textContent).toContain('Settings')
			expect(container.textContent).toContain('Overview')
		})

		it('renders nested catch-all routes when no child matches', ()=> {
			window.history.replaceState(null, '', '/settings/missing')
			const container = document.createElement('div')
			document.body.appendChild(container)

			const Settings = ()=> h('div', null, h('span', null, 'Settings'), h(Outlet, null))
			const Profile = ()=> h('p', null, 'Profile')
			const NotFound = ()=> h('p', null, 'Nested 404')

			const App = ()=> h(Router, null, h(Route, { path: '/settings', component: Settings }, h(Route, { path: '/profile', component: Profile }), h(Route, { path: '*', component: NotFound })))

			renderApp(container, h(App))
			expect(container.textContent).toContain('Settings')
			expect(container.textContent).toContain('Nested 404')
			expect(container.textContent).not.toContain('Profile')
		})

		it('renders transparent parent route (no component) with nested children', ()=> {
			window.history.replaceState(null, '', '/settings/profile')
			const container = document.createElement('div')
			document.body.appendChild(container)

			const Profile = ()=> h('p', null, 'Profile')

			const App = ()=> h(Router, null, h(Route, { path: '/settings' }, h(Route, { path: '/profile', component: Profile })))

			renderApp(container, h(App))
			expect(container.textContent).toContain('Profile')
		})

		it('disposes nested branch on route change', ()=> {
			window.history.replaceState(null, '', '/settings/profile')
			const container = document.createElement('div')
			document.body.appendChild(container)

			const Settings = ()=> h('div', null, h(Outlet, null))
			const Profile = vi.fn(()=> h('p', null, 'Profile'))
			const Security = vi.fn(()=> h('p', null, 'Security'))

			const App = ()=> h(Router, null, h(Route, { path: '/settings', component: Settings }, h(Route, { path: '/profile', component: Profile }), h(Route, { path: '/security', component: Security })))

			renderApp(container, h(App))
			expect(Profile).toHaveBeenCalledTimes(1)
			expect(Security).not.toHaveBeenCalled()

			window.history.pushState(null, '', '/settings/security')
			window.dispatchEvent(new PopStateEvent('popstate'))
			expect(Security).toHaveBeenCalledTimes(1)
			// Profile branch disposed; not called again
			expect(Profile).toHaveBeenCalledTimes(1)
			expect(container.textContent).toBe('Security')
		})
	})
})
