import {
	Match,
	createContext,
	createSignal,
	h,
	registerCleanup,
	useContext,
} from './jsx-runtime.js'

const normalizeTarget = (value)=> {
	let target = String(value ?? '/').trim()
	if (!target){
		target = '/'
	}
	if (!target.startsWith('/')){
		target = `/${target}`
	}
	return target
}

const stripQueryAndHash = target=> target.split(/[?#]/, 1)[0] || '/'

const normalizePath = (value)=> {
	let path = stripQueryAndHash(normalizeTarget(value))
	path = path.replace(/\/{2,}/g, '/')
	if (path.length > 1){
		path = path.replace(/\/+$/, '')
	}
	return path || '/'
}

// Contexts ─────────────────────────────────────────────────────────────────
// RouterContext: { currentPath: Signal<string>, basePath: string }
// Provided by Router; updated by each parent Route so nested branches can
// read the accumulated base path.
const RouterContext = createContext(null)

// NestedRoutesContext: RouteDescriptor[]
// Provided by a parent Route so that <Outlet> inside the component knows
// which child routes to render.
const NestedRoutesContext = createContext(null)

// Helpers ──────────────────────────────────────────────────────────────────

// Join a base path and a route segment, both already normalised.
// joinPaths('/settings', '/profile') → '/settings/profile'
// joinPaths('/',         '/profile') → '/profile'
// joinPaths('/settings', '/')        → '/settings'  (index route)
const joinPaths = (base, segment)=> {
	if (segment === '*'){
		return '*'
	}
	if (segment === '/' || segment === ''){
		return normalizePath(base)
	}
	const cleanBase = base === '/' ? '' : normalizePath(base)
	const cleanSegment = segment.startsWith('/') ? segment : `/${segment}`
	return normalizePath(cleanBase + cleanSegment)
}

// Build a reactive Match element from a flat list of RouteDescriptors.
// Parent routes (those with nested route children) use prefix matching;
// leaf routes use exact equality matching.
// basePath is the already-accumulated prefix at this router level (root-
// relative, so always starts with '/').
const buildRouteMatch = (routes, currentPath, basePath)=> {
	const nonDefault = routes.filter(r=> !r.isDefault)
	const defaultRoute = routes.find(r=> r.isDefault)

	// Compute the index of the currently active route reactively.
	// Returning -1 means "no match" → Match falls through to defaultBranch.
	const activeIndex = ()=> {
		const path = currentPath()
		for (const [i, r] of nonDefault.entries()){
			const fullPath = joinPaths(basePath, r.when)
			const isParent = r.nestedRoutes && r.nestedRoutes.length > 0
			const matched = isParent ? path === fullPath || path.startsWith(`${fullPath}/`) : path === fullPath
			if (matched){
				return i
			}
		}
		return -1
	}

	const cases = nonDefault.map((r, i)=> ({ when: i, branch: r.branch }))

	return h(Match, {
		value: activeIndex,
		cases,
		...defaultRoute ? { defaultBranch: defaultRoute.branch } : {},
	})
}

const readCurrentPath = (root = '/')=> {
	if (typeof window === 'undefined'){
		return '/'
	}
	const fullPath = normalizePath(window.location.pathname || '/')
	const normalizedRoot = normalizePath(root)
	if (normalizedRoot === '/'){
		return fullPath
	}
	if (fullPath.startsWith(normalizedRoot)){
		const relative = fullPath.slice(normalizedRoot.length) || '/'
		return relative.startsWith('/') ? relative : `/${relative}`
	}
	return fullPath
}

const sharedRouterVersion = createSignal(0)
const sharedRouterState = {
	currentPath: createSignal(readCurrentPath()),
	navigate: ()=> {},
	createHref: to=> normalizeTarget(to),
}

const touchSharedRouter = ()=> {
	sharedRouterVersion(sharedRouterVersion() + 1)
}

const createNavigationApi = (setCurrentPath, root = '/')=> {
	const normalizedRoot = normalizePath(root)
	const withRoot = (path)=> {
		if (normalizedRoot === '/'){ return path }
		return normalizedRoot + (path === '/' ? '' : path)
	}

	if (typeof window === 'undefined'){
		return {
			createHref: to=> withRoot(normalizeTarget(to)),
			navigate: ()=> {},
		}
	}

	return {
		createHref: to=> withRoot(normalizeTarget(to)),
		navigate: (to, options = {})=> {
			const target = withRoot(normalizeTarget(to))
			const nextPath = normalizePath(normalizeTarget(to))
			const replace = Boolean(options.replace)
			const method = replace ? 'replaceState' : 'pushState'
			window.history[method](window.history.state, '', target)
			setCurrentPath(nextPath)
		},
	}
}

const Router = ({ children, root = '/' })=> {
	const currentPath = createSignal(readCurrentPath(root))
	const syncPath = ()=> {
		currentPath(readCurrentPath(root))
	}
	if (typeof window !== 'undefined'){
		window.addEventListener('popstate', syncPath)
		registerCleanup(()=> {
			window.removeEventListener('popstate', syncPath)
		})
	}

	const navigation = createNavigationApi(currentPath, root)
	sharedRouterState.currentPath = currentPath
	sharedRouterState.navigate = navigation.navigate
	sharedRouterState.createHref = navigation.createHref
	touchSharedRouter()

	// All path matching happens in root-relative space (readCurrentPath strips
	// the root prefix), so the base for the top-level match is always '/'.
	const basePath = '/'
	const routerCtx = { currentPath, basePath }

	const childArray = Array.isArray(children) ? children : [children]
	const routeMarkers = childArray.filter(child=> child instanceof Comment && child._routeDescriptor)
	const otherChildren = childArray.filter(child=> !(child instanceof Comment && child._routeDescriptor))

	const routes = routeMarkers.map(child=> child._routeDescriptor)

	// Wrap the entire output in RouterContext.Provider with lazy children so
	// that the Match (and every branch owner it creates) are nested inside the
	// provider's owner.  This ensures branch-level renderMatch calls can reach
	// RouterContext via useContext's owner-chain walk.
	return h(RouterContext.Provider, {
		value: routerCtx,
		children: ()=> {
			const matchElement = buildRouteMatch(routes, currentPath, basePath)
			if (otherChildren.length === 0){
				return matchElement
			}

			const fragment = document.createDocumentFragment()
			otherChildren.forEach((child)=> {
				if (child instanceof Node){
					fragment.appendChild(child)
				}
			})
			fragment.appendChild(matchElement)
			return fragment
		},
	})
}

const Route = ({
	path = '/',
	index = false,
	component,
	children,
	...componentProps
})=> {
	const expectedPath = index ? '/' : normalizePath(path)
	const isDefault = expectedPath === '*' || path === '*'

	// Partition children into nested Route markers and ordinary content.
	// Function children (render props) cannot contain nested Route markers, so
	// they are treated as leaf content only.
	const isFunctionChildren = typeof children === 'function'
	const childArray = isFunctionChildren || children === undefined ? [] : Array.isArray(children) ? children : [children]

	const nestedRouteMarkers = childArray.filter(c=> c instanceof Comment && c._routeDescriptor)
	const nestedRoutes = nestedRouteMarkers.map(c=> c._routeDescriptor)
	const contentChildren = childArray.filter(c=> !(c instanceof Comment && c._routeDescriptor))

	const hasNestedRoutes = nestedRoutes.length > 0
	const hasContentChildren = contentChildren.length > 0

	const renderMatch = ()=> {
		if (hasNestedRoutes){
			// Read the current routing context to obtain the accumulated base path
			// and the currentPath signal.  This call is safe because renderMatch is
			// always invoked lazily, inside mountDynamic's branch owner, which is a
			// descendant of the RouterContext.Provider set up by Router (or a parent
			// Route).
			const ctx = useContext(RouterContext)
			const ctxBasePath = ctx ? ctx.basePath : '/'
			const ctxCurrentPath = ctx ? ctx.currentPath : sharedRouterState.currentPath
			const newBasePath = joinPaths(ctxBasePath, expectedPath)
			const newCtx = { currentPath: ctxCurrentPath, basePath: newBasePath }

			if (typeof component === 'function'){
				// Render the component wrapped in updated Router + NestedRoutes
				// contexts.  Children passed as lazy functions ensure the provider
				// owners are established *before* the component function runs, so
				// useContext calls inside the component (e.g. inside <Outlet>) see
				// the correct values.
				return h(RouterContext.Provider, {
					value: newCtx,
					children: ()=> h(NestedRoutesContext.Provider, {
						value: nestedRoutes,
						children: ()=> h(component, componentProps),
					}),
				})
			}

			// Transparent parent route (no component): provide the updated context
			// and directly build the nested Match so child routes are rendered.
			return h(RouterContext.Provider, {
				value: newCtx,
				children: ()=> {
					const nestedMatch = buildRouteMatch(nestedRoutes, ctxCurrentPath, newBasePath)
					if (!hasContentChildren){
						return nestedMatch
					}
					const frag = document.createDocumentFragment()
					contentChildren.forEach((c)=> { if (c instanceof Node){ frag.appendChild(c) } })
					frag.appendChild(nestedMatch)
					return frag
				},
			})
		}

		// Leaf route: backward-compatible behaviour.
		if (isFunctionChildren){
			return children(componentProps)
		}
		if (hasContentChildren){
			return contentChildren.length === 1 ? contentChildren[0] : contentChildren
		}
		if (typeof component === 'function'){
			return h(component, componentProps)
		}
		return []
	}

	const marker = document.createComment('route')
	marker._routeDescriptor = {
		when: expectedPath, branch: renderMatch, isDefault, nestedRoutes,
	}
	return marker
}

// <Outlet /> renders the matched child route inside a parent route component.
// It reads RouterContext (updated base path) and NestedRoutesContext (child
// route descriptors) that were provided by the parent Route's renderMatch.
const Outlet = ()=> {
	const ctx = useContext(RouterContext)
	const nestedRoutes = useContext(NestedRoutesContext)

	if (!ctx || !nestedRoutes || nestedRoutes.length === 0){
		return null
	}

	return buildRouteMatch(nestedRoutes, ctx.currentPath, ctx.basePath)
}

const isPlainLeftClick = event=> event.button === 0 && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey

const Link = ({
	to = '/',
	replace = false,
	onClick,
	target,
	children,
	...props
})=> {
	const resolveTarget = ()=> normalizeTarget(typeof to === 'function' ? to() : to)
	const href = ()=> {
		sharedRouterVersion()
		return sharedRouterState.createHref(resolveTarget())
	}
	const handleClick = (event)=> {
		if (typeof onClick === 'function'){
			onClick(event)
		}
		if (event.defaultPrevented || !isPlainLeftClick(event)){
			return
		}
		if (target && target !== '_self'){
			return
		}
		event.preventDefault()
		sharedRouterState.navigate(resolveTarget(), { replace })
	}

	return h('a', {
		...props,
		href,
		onClick: handleClick,
		...target ? { target } : {},
	}, children)
}

const navigate = (to, options = {})=> {
	sharedRouterState.navigate(to, options)
}

export {
	Link,
	navigate,
	Outlet,
	Route,
	Router,
}
