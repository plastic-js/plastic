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
	NavLink,
	Outlet,
	Route,
	Router,
	h,
	renderApp,
	useLocation,
	useNavigate,
	useParams,
	useRoute,
	useSearchParams,
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

	it('NavLink applies an active class for the current route', ()=> {
		window.history.replaceState(null, '', '/about')
		const container = document.createElement('div')
		document.body.appendChild(container)

		const App = ()=> h(Router, null, h('nav', null, h(NavLink, { to: '/' }, 'Home'), h(NavLink, { to: '/about', className: 'nav-item' }, 'About')), h(Route, { path: '/' }, h('p', null, 'Home page')), h(Route, { path: '/about' }, h('p', null, 'About page')))

		renderApp(container, h(App))
		const links = container.querySelectorAll('a')

		expect(links[0].className).toBe('')
		expect(links[0].getAttribute('aria-current')).toBeNull()
		expect(links[1].className).toBe('nav-item active')
		expect(links[1].getAttribute('aria-current')).toBe('page')

		window.history.pushState(null, '', '/')
		window.dispatchEvent(new PopStateEvent('popstate'))

		expect(links[0].className).toBe('active')
		expect(links[0].getAttribute('aria-current')).toBe('page')
		expect(links[1].className).toBe('nav-item')
		expect(links[1].getAttribute('aria-current')).toBeNull()
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

	it('passes dynamic path params to route components', ()=> {
		window.history.replaceState(null, '', '/users/42')
		const container = document.createElement('div')
		document.body.appendChild(container)

		const User = ({ params })=> h('p', null, `User ${params.id}`)
		const App = ()=> h(Router, null, h(Route, {
			path: '/users/:id',
			component: User,
		}))

		renderApp(container, h(App))
		expect(container.textContent).toBe('User 42')

		window.history.pushState(null, '', '/users/7')
		window.dispatchEvent(new PopStateEvent('popstate'))
		expect(container.textContent).toBe('User 7')
	})

	it('exposes query information through useRoute', ()=> {
		window.history.replaceState(null, '', '/search?tab=people&sort=asc')
		const container = document.createElement('div')
		document.body.appendChild(container)

		const Search = ()=> {
			const route = useRoute()
			return h('p', null, `${route.pathname}|${route.search}|${route.query.tab}|${route.query.sort}`)
		}

		const App = ()=> h(Router, null, h(Route, {
			path: '/search',
			component: Search,
		}))

		renderApp(container, h(App))
		expect(container.textContent).toBe('/search|?tab=people&sort=asc|people|asc')
	})

	it('keeps query and hash in Link href and navigate updates route query', ()=> {
		window.history.replaceState(null, '', '/')
		const container = document.createElement('div')
		document.body.appendChild(container)

		const Search = ()=> {
			const route = useRoute()
			return h('p', null, route.query.tab || 'none')
		}

		const App = ()=> h(Router, null, h(Link, { to: '/search?tab=popular#top' }, 'Popular'), h(Route, { path: '/search', component: Search }))

		renderApp(container, h(App))
		const link = container.querySelector('a')
		expect(link.getAttribute('href')).toBe('/search?tab=popular#top')

		link.dispatchEvent(new MouseEvent('click', {
			bubbles: true,
			button: 0,
			cancelable: true,
		}))

		expect(window.location.pathname).toBe('/search')
		expect(window.location.search).toBe('?tab=popular')
		expect(window.location.hash).toBe('#top')
		expect(container.textContent).toContain('popular')
	})

	it('useNavigate performs programmatic navigation', ()=> {
		window.history.replaceState(null, '', '/')
		const container = document.createElement('div')
		document.body.appendChild(container)

		const Home = ()=> {
			const nav = useNavigate()
			return h('button', {
				onClick: ()=> nav('/about?from=home'),
			}, 'Go')
		}

		const About = ()=> {
			const location = useLocation()
			return h('p', null, `${location().pathname}${location().search}`)
		}

		const App = ()=> h(Router, null, h(Route, { path: '/', component: Home }), h(Route, { path: '/about', component: About }))

		renderApp(container, h(App))
		const button = container.querySelector('button')
		button.dispatchEvent(new MouseEvent('click', {
			bubbles: true,
			button: 0,
			cancelable: true,
		}))

		expect(window.location.pathname).toBe('/about')
		expect(window.location.search).toBe('?from=home')
		expect(container.textContent).toContain('/about?from=home')
	})

	it('useParams returns current dynamic params', ()=> {
		window.history.replaceState(null, '', '/posts/99')
		const container = document.createElement('div')
		document.body.appendChild(container)

		const Post = ()=> {
			const params = useParams()
			return h('p', null, params.id)
		}

		const App = ()=> h(Router, null, h(Route, {
			path: '/posts/:id',
			component: Post,
		}))

		renderApp(container, h(App))
		expect(container.textContent).toBe('99')
	})

	it('useSearchParams exposes query accessor and setter', ()=> {
		window.history.replaceState(null, '', '/search?tab=latest')
		const container = document.createElement('div')
		document.body.appendChild(container)

		const Search = ()=> {
			const [searchParams, setSearchParams] = useSearchParams()
			return h('div', null, h('p', null, searchParams().tab || 'none'), h('button', {
				onClick: ()=> setSearchParams({
					tab: 'trending',
					page: 2,
				}),
			}, 'Update'))
		}

		const App = ()=> h(Router, null, h(Route, {
			path: '/search',
			component: Search,
		}))

		renderApp(container, h(App))
		expect(container.textContent).toContain('latest')

		const button = container.querySelector('button')
		button.dispatchEvent(new MouseEvent('click', {
			bubbles: true,
			button: 0,
			cancelable: true,
		}))

		expect(window.location.search).toBe('?tab=trending&page=2')
		expect(container.textContent).toContain('trending')
	})

	it('blocks guarded routes and falls through to a catch-all route', ()=> {
		window.history.replaceState(null, '', '/admin')
		const container = document.createElement('div')
		document.body.appendChild(container)

		const App = ()=> h(Router, null, h(Route, {
			path: '/admin',
			guard: ()=> false,
		}, h('p', null, 'Admin')), h(Route, {
			path: '*',
		}, h('p', null, 'Not found')))

		renderApp(container, h(App))
		expect(window.location.pathname).toBe('/admin')
		expect(container.textContent).toBe('Not found')
	})

	it('redirects guarded routes with beforeEnter', ()=> {
		window.history.replaceState(null, '', '/admin')
		const container = document.createElement('div')
		document.body.appendChild(container)

		const App = ()=> h(Router, null, h(Route, {
			path: '/admin',
			beforeEnter: ({ pathname })=> ({
				pathname: '/login',
				search: { redirect: pathname },
			}),
		}, h('p', null, 'Admin')), h(Route, {
			path: '/login',
		}, h('p', null, 'Login')))

		renderApp(container, h(App))
		expect(window.location.pathname).toBe('/login')
		expect(window.location.search).toBe('?redirect=%2Fadmin')
		expect(container.textContent).toBe('Login')
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

		it('supports params in nested routes and reads them in child Outlet branch', ()=> {
			window.history.replaceState(null, '', '/teams/acme/members/7')
			const container = document.createElement('div')
			document.body.appendChild(container)

			const TeamShell = ()=> h('section', null, h('h2', null, 'Team'), h(Outlet, null))
			const Member = ()=> {
				const route = useRoute()
				return h('p', null, `${route.params.teamId}:${route.params.memberId}`)
			}

			const App = ()=> h(Router, null, h(Route, { path: '/teams/:teamId', component: TeamShell }, h(Route, { path: '/members/:memberId', component: Member })))

			renderApp(container, h(App))
			expect(container.textContent).toContain('acme:7')
		})
	})
})
