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

const createUrl = value=> new URL(normalizeTarget(value), 'https://plastic.local')

const stripQueryAndHash = target=> createUrl(target).pathname || '/'

const splitSegments = (path)=> {
	const normalized = normalizePath(path)
	if (normalized === '/'){
		return []
	}
	return normalized.slice(1).split('/')
}

const parseQuery = (search)=> {
	const query = {}
	const params = new URLSearchParams(search || '')
	for (const [key, value] of params.entries()){
		if (Object.prototype.hasOwnProperty.call(query, key)){
			const current = query[key]
			query[key] = Array.isArray(current) ? [...current, value] : [current, value]
			continue
		}
		query[key] = value
	}
	return query
}

const toSearchString = (input)=> {
	if (typeof input === 'string'){
		if (!input){
			return ''
		}
		return input.startsWith('?') ? input : `?${input}`
	}

	const params = new URLSearchParams()
	if (input instanceof URLSearchParams){
		return input.toString() ? `?${input.toString()}` : ''
	}

	if (!input || typeof input !== 'object'){
		return ''
	}

	Object.entries(input).forEach(([key, value])=> {
		if (value == null){
			return
		}
		if (Array.isArray(value)){
			value.forEach((entry)=> {
				if (entry != null){
					params.append(key, String(entry))
				}
			})
			return
		}
		params.set(key, String(value))
	})

	const text = params.toString()
	return text ? `?${text}` : ''
}

const createLocation = (value)=> {
	const url = createUrl(value)
	const pathname = normalizePath(url.pathname || '/')
	const search = url.search || ''
	const hash = url.hash || ''
	return {
		pathname,
		search,
		hash,
		query: parseQuery(search),
	}
}

const normalizePath = (value)=> {
	let path = stripQueryAndHash(normalizeTarget(value))
	path = path.replace(/\/{2,}/g, '/')
	if (path.length > 1){
		path = path.replace(/\/+$/, '')
	}
	return path || '/'
}

// Contexts ─────────────────────────────────────────────────────────────────
// RouterContext: { currentPath: ()=> string, currentLocation: Signal<Location>, basePath: string }
// Provided by Router; updated by each parent Route so nested branches can
// read the accumulated base path.
const RouterContext = createContext(null)

// RouteMatchContext: RouteMatch
// Provided by buildRouteMatch so route components can read params/search/query.
const RouteMatchContext = createContext(null)

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

const createRouteMatcher = (routePath)=> {
	const routeSegments = splitSegments(routePath)
	const matchSegments = (pathname, isPrefix)=> {
		const pathSegments = splitSegments(pathname)
		if (!isPrefix && routeSegments.length !== pathSegments.length){
			return null
		}
		if (isPrefix && routeSegments.length > pathSegments.length){
			return null
		}

		const params = {}
		for (const [index, segment] of routeSegments.entries()){
			const current = pathSegments[index]
			if (current === undefined){
				return null
			}

			if (segment.startsWith(':') && segment.length > 1){
				params[segment.slice(1)] = current
				continue
			}

			if (segment !== current){
				return null
			}
		}

		return params
	}

	return {
		matchExact: pathname=> matchSegments(pathname, false),
		matchPrefix: pathname=> matchSegments(pathname, true),
	}
}

const createRouteMatchInfo = ({
	routePath, pathname, params, location,
})=> ({
	path: routePath,
	pathname,
	params,
	search: location.search,
	hash: location.hash,
	query: location.query,
})

const normalizeGuardRedirect = (result)=> {
	if (typeof result === 'string' || result instanceof URLSearchParams){
		return String(result)
	}

	if (!result || typeof result !== 'object' || Array.isArray(result)){
		return null
	}

	if (typeof result.to === 'string' || result.to instanceof URLSearchParams){
		return String(result.to)
	}

	if (typeof result.pathname !== 'string'){
		return null
	}

	const search = result.search ? toSearchString(result.search) : ''
	const hash = result.hash ? String(result.hash).startsWith('#') ? String(result.hash) : `#${String(result.hash)}` : ''
	return `${result.pathname}${search}${hash}`
}

const evaluateRouteGuard = ({
	guard,
	beforeEnter,
	match,
	currentLocation,
})=> {
	const resolver = typeof guard === 'function' ? guard : typeof beforeEnter === 'function' ? beforeEnter : null
	if (!resolver){
		return {
			allow: true,
			redirectTo: null,
		}
	}

	const result = resolver({
		to: match,
		from: currentLocation,
		params: match.params,
		query: match.query,
		pathname: match.pathname,
		search: match.search,
		hash: match.hash,
	})

	if (result === true || result == null){
		return {
			allow: true,
			redirectTo: null,
		}
	}

	const redirectTo = normalizeGuardRedirect(result)
	if (redirectTo){
		return {
			allow: false,
			redirectTo,
		}
	}

	return {
		allow: false,
		redirectTo: null,
	}
}

// Build a reactive Match element from a flat list of RouteDescriptors.
// Parent routes (those with nested route children) use prefix matching;
// leaf routes use exact equality matching.
// basePath is the already-accumulated prefix at this router level (root-
// relative, so always starts with '/').
const buildRouteMatch = (routes, currentLocation, basePath)=> {
	const nonDefault = routes.filter(r=> !r.isDefault)
	const defaultRoute = routes.find(r=> r.isDefault)

	// Compute the index of the currently active route reactively.
	// Returning -1 means "no match" → Match falls through to defaultBranch.
	const readCandidateMatch = ()=> {
		const resolveCandidateMatch = (location, redirectDepth = 0)=> {
			const pathname = location.pathname

			for (const [i, r] of nonDefault.entries()){
				const fullPath = joinPaths(basePath, r.when)
				const isParent = r.nestedRoutes && r.nestedRoutes.length > 0
				const matcher = createRouteMatcher(fullPath)
				const params = isParent ? matcher.matchPrefix(pathname) : matcher.matchExact(pathname)
				if (params){
					const match = createRouteMatchInfo({
						routePath: fullPath,
						pathname,
						params,
						location,
					})
					const guardState = evaluateRouteGuard({
						guard: r.guard,
						beforeEnter: r.beforeEnter,
						match,
						currentLocation: location,
					})
					if (!guardState.allow){
						if (guardState.redirectTo){
							const target = normalizeTarget(guardState.redirectTo)
							const currentTarget = `${location.pathname}${location.search}${location.hash}`
							if (target !== currentTarget && redirectDepth < nonDefault.length){
								sharedRouterState.navigate(target, {
									replace: true,
								})
								return resolveCandidateMatch(createLocation(target), redirectDepth + 1)
							}
						}
						continue
					}

					return {
						index: i,
						match,
					}
				}
			}

			let defaultMatch = null
			if (defaultRoute){
				defaultMatch = createRouteMatchInfo({
					routePath: '*',
					pathname,
					params: {},
					location,
				})
			}

			return {
				index: -1,
				match: defaultMatch,
			}
		}

		return resolveCandidateMatch(currentLocation())
	}

	const activeIndex = ()=> {
		const candidate = readCandidateMatch()
		return candidate.index
	}

	const cases = nonDefault.map((r, i)=> ({
		when: i,
		branch: ()=> {
			const candidate = readCandidateMatch()
			if (candidate.index !== i || !candidate.match){
				return null
			}
			return h(RouteMatchContext.Provider, {
				value: candidate.match,
				children: ()=> r.branch(candidate.match),
			})
		},
	}))

	let defaultBranch
	if (defaultRoute){
		defaultBranch = ()=> {
			const candidate = readCandidateMatch()
			if (!candidate.match){
				return defaultRoute.branch(null)
			}
			return h(RouteMatchContext.Provider, {
				value: candidate.match,
				children: ()=> defaultRoute.branch(candidate.match),
			})
		}
	}

	return h(Match, {
		value: activeIndex,
		cases,
		...defaultBranch ? { defaultBranch } : {},
	})
}

const readCurrentLocation = (root = '/')=> {
	if (typeof window === 'undefined'){
		return createLocation('/')
	}
	const fullLocation = createLocation(`${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`)
	const fullPath = fullLocation.pathname
	const normalizedRoot = normalizePath(root)
	if (normalizedRoot === '/'){
		return fullLocation
	}
	if (fullPath.startsWith(normalizedRoot)){
		const relative = fullPath.slice(normalizedRoot.length) || '/'
		return {
			...fullLocation,
			pathname: relative.startsWith('/') ? relative : `/${relative}`,
		}
	}
	return fullLocation
}

const sharedRouterVersion = createSignal(0)
const sharedRouterState = {
	currentLocation: createSignal(readCurrentLocation()),
	navigate: ()=> {},
	createHref: to=> normalizeTarget(to),
}

const touchSharedRouter = ()=> {
	sharedRouterVersion(sharedRouterVersion() + 1)
}

const createNavigationApi = (setCurrentLocation, root = '/')=> {
	const normalizedRoot = normalizePath(root)
	const withRoot = (location)=> {
		const rootedPathname = normalizedRoot === '/' ? location.pathname : normalizedRoot + (location.pathname === '/' ? '' : location.pathname)
		return `${rootedPathname}${location.search}${location.hash}`
	}

	if (typeof window === 'undefined'){
		return {
			createHref: to=> withRoot(createLocation(to)),
			navigate: ()=> {},
		}
	}

	return {
		createHref: to=> withRoot(createLocation(to)),
		navigate: (to, options = {})=> {
			const nextLocation = createLocation(to)
			const target = withRoot(nextLocation)
			const replace = Boolean(options.replace)
			const method = replace ? 'replaceState' : 'pushState'
			window.history[method](window.history.state, '', target)
			setCurrentLocation(nextLocation)
		},
	}
}

const Router = ({ children, root = '/' })=> {
	const currentLocation = createSignal(readCurrentLocation(root))
	const currentPath = ()=> currentLocation().pathname
	const syncPath = ()=> {
		currentLocation(readCurrentLocation(root))
	}
	if (typeof window !== 'undefined'){
		window.addEventListener('popstate', syncPath)
		registerCleanup(()=> {
			window.removeEventListener('popstate', syncPath)
		})
	}

	const navigation = createNavigationApi(currentLocation, root)
	sharedRouterState.currentLocation = currentLocation
	sharedRouterState.navigate = navigation.navigate
	sharedRouterState.createHref = navigation.createHref
	touchSharedRouter()

	// All path matching happens in root-relative space (readCurrentPath strips
	// the root prefix), so the base for the top-level match is always '/'.
	const basePath = '/'
	const routerCtx = {
		currentLocation, currentPath, basePath,
	}

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
			const matchElement = buildRouteMatch(routes, currentLocation, basePath)
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
	guard,
	beforeEnter,
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

	const renderMatch = (routeMatch = null)=> {
		const routeProps = {
			...componentProps,
			params: routeMatch ? routeMatch.params : {},
			query: routeMatch ? routeMatch.query : {},
			route: routeMatch,
		}

		if (hasNestedRoutes){
			// Read the current routing context to obtain the accumulated base path
			// and the currentPath signal.  This call is safe because renderMatch is
			// always invoked lazily, inside mountDynamic's branch owner, which is a
			// descendant of the RouterContext.Provider set up by Router (or a parent
			// Route).
			const ctx = useContext(RouterContext)
			const ctxBasePath = ctx ? ctx.basePath : '/'
			const ctxCurrentLocation = ctx ? ctx.currentLocation : sharedRouterState.currentLocation
			const newBasePath = joinPaths(ctxBasePath, expectedPath)
			const newCtx = {
				currentLocation: ctxCurrentLocation,
				currentPath: ()=> ctxCurrentLocation().pathname,
				basePath: newBasePath,
			}

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
						children: ()=> h(component, routeProps),
					}),
				})
			}

			// Transparent parent route (no component): provide the updated context
			// and directly build the nested Match so child routes are rendered.
			return h(RouterContext.Provider, {
				value: newCtx,
				children: ()=> {
					const nestedMatch = buildRouteMatch(nestedRoutes, ctxCurrentLocation, newBasePath)
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
			return children(routeProps)
		}
		if (hasContentChildren){
			return contentChildren.length === 1 ? contentChildren[0] : contentChildren
		}
		if (typeof component === 'function'){
			return h(component, routeProps)
		}
		return []
	}

	const marker = document.createComment('route')
	marker._routeDescriptor = {
		when: expectedPath, branch: renderMatch, isDefault, nestedRoutes, guard, beforeEnter,
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

	return buildRouteMatch(nestedRoutes, ctx.currentLocation, ctx.basePath)
}

const useRoute = ()=> useContext(RouteMatchContext)

const useLocation = ()=> {
	const ctx = useContext(RouterContext)
	return ctx ? ctx.currentLocation : sharedRouterState.currentLocation
}

const useNavigate = ()=> (to, options = {})=> {
	sharedRouterState.navigate(to, options)
}

const useParams = ()=> {
	const route = useRoute()
	return route ? route.params : {}
}

const useSearchParams = ()=> {
	const location = useLocation()
	const setSearchParams = (next, options = {})=> {
		const current = location()
		const nextValue = typeof next === 'function' ? next(current.query) : next
		const nextSearch = toSearchString(nextValue)
		const target = `${current.pathname}${nextSearch}${current.hash}`
		sharedRouterState.navigate(target, options)
	}
	return [()=> location().query, setSearchParams]
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
	useLocation,
	useNavigate,
	useParams,
	useRoute,
	useSearchParams,
}
