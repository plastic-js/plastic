import { css } from '@emotion/css'
import {
	NavLink,
	Route,
	Router,
	lazy,
	renderApp,
} from '@plastic-js/plastic'
import './global.css'

const Loading = ()=> <div className='checklist' style={{ padding: '12px' }}>Loading...</div>

const lazyPage = (loader)=> lazy(loader, { fallback: Loading })

const SignalsFunctionComponents = lazyPage(()=> import('./sections/runtime/SignalsFunctionComponentsShowcase.jsx'))
const ParentToChildProps = lazyPage(()=> import('./sections/runtime/ParentToChildPropsShowcase.jsx'))
const EventBinding = lazyPage(()=> import('./sections/runtime/EventBindingShowcase.jsx'))
const FormHandling = lazyPage(()=> import('./sections/runtime/FormHandlingShowcase.jsx'))
const ReactiveProps = lazyPage(()=> import('./sections/runtime/ReactivePropsShowcase.jsx'))
const FunctionWrappedDynamics = lazyPage(()=> import('./sections/runtime/FunctionWrappedDynamicsShowcase.jsx'))
const ReactiveTernary = lazyPage(()=> import('./sections/runtime/ReactiveTernaryShowcase.jsx'))
const ControlFlowEither = lazyPage(()=> import('./sections/runtime/ControlFlowEitherShowcase.jsx'))
const ControlFlowLoop = lazyPage(()=> import('./sections/runtime/ControlFlowLoopShowcase.jsx'))
const ToggleGroupLoop = lazyPage(()=> import('./sections/runtime/ToggleGroupLoopShowcase.jsx'))
const LifecycleDispose = lazyPage(()=> import('./sections/runtime/LifecycleDisposeShowcase.jsx'))
const PortalShowcase = lazyPage(()=> import('./sections/runtime/PortalShowcase.jsx'))
const ContextProvider = lazyPage(()=> import('./sections/runtime/ContextProviderShowcase.jsx'))

const NotFound = ()=> (
	<div className='feature-card'>
		<h2>Route not found</h2>
		<p className='feature-copy'>Choose a page from the left menu.</p>
	</div>
)

const menuItems = [
	{ label: 'Signals & function components', path: '/runtime/signals-function-components' },
	{ label: 'Parent to child props', path: '/runtime/parent-to-child-props' },
	{ label: 'Event binding', path: '/runtime/event-binding' },
	{ label: 'Form handling', path: '/runtime/form-handling' },
	{ label: 'Reactive props', path: '/runtime/reactive-props' },
	{ label: 'Function-wrapped dynamics', path: '/runtime/function-wrapped-dynamics' },
	{ label: 'Reactive ternary', path: '/runtime/reactive-ternary' },
	{ label: 'Control flow with Either', path: '/runtime/control-flow-either' },
	{ label: 'Control flow with Loop', path: '/runtime/control-flow-loop' },
	{ label: 'Toggle group with Loop', path: '/runtime/toggle-group-loop' },
	{ label: 'Lifecycle & dispose', path: '/runtime/lifecycle-dispose' },
	{ label: 'Portal', path: '/runtime/portal' },
	{ label: 'Context Provider', path: '/runtime/context-provider' },
	{ label: 'Page One', path: '/pages/page-one', disabled: true },
	{ label: 'Page Two', path: '/pages/page-two', disabled: true },
]

const menuLinkClass = css`
	display: block;
	padding: 10px 12px;
	border-radius: 8px;
	text-decoration: none;
	font-size: 1rem;
	color: #334155;
	font-weight: 500;

	&[aria-disabled='true'] {
		color: #94a3b8;
		cursor: not-allowed;
		opacity: 0.6;
		text-decoration: none;
	}
`

const Sidebar = ()=> (
	<aside
		style={{
			padding: '24px 16px',
			borderRight: '1px solid #cbd5e1',
			background: 'rgba(255, 255, 255, 0.82)',
			backdropFilter: 'blur(8px)',
			position: 'sticky',
			top: 0,
			height: '100vh',
			overflowY: 'auto',
		}}
	>
		<p className='eyebrow' style={{ marginBottom: '12px' }}>Showcase Menu</p>
		<h2 style={{ marginTop: 0, marginBottom: '14px' }}>Pages</h2>
		<nav style={{ display: 'grid', gap: '8px' }}>
			{menuItems.map(item=> (
				<NavLink
					activeClass='menu-link-active'
					className={menuLinkClass}
					key={item.path}
					to={item.path}
					disabled={item.disabled}
				>
					{item.label}
				</NavLink>
			))}
		</nav>
	</aside>
)

renderApp(
	document.body.querySelector('.app'),
	<div
		style={{
			display: 'grid',
			gridTemplateColumns: '280px 700px',
			minHeight: '100vh',
			width: '100%',
			alignSelf: 'stretch',
			background: 'linear-gradient(145deg, #f8fafc 0%, #eef2ff 45%, #f0fdf4 100%)',
		}}
	>
		<Router root='/showcase'>
			<Sidebar />
			<Route component={SignalsFunctionComponents} path='/runtime/signals-function-components' />
			<Route component={ParentToChildProps} path='/runtime/parent-to-child-props' />
			<Route component={EventBinding} path='/runtime/event-binding' />
			<Route component={FormHandling} path='/runtime/form-handling' />
			<Route component={ReactiveProps} path='/runtime/reactive-props' />
			<Route component={FunctionWrappedDynamics} path='/runtime/function-wrapped-dynamics' />
			<Route component={ReactiveTernary} path='/runtime/reactive-ternary' />
			<Route component={ControlFlowEither} path='/runtime/control-flow-either' />
			<Route component={ControlFlowLoop} path='/runtime/control-flow-loop' />
			<Route component={ToggleGroupLoop} path='/runtime/toggle-group-loop' />
			<Route component={LifecycleDispose} path='/runtime/lifecycle-dispose' />
			<Route component={PortalShowcase} path='/runtime/portal' />
			<Route component={ContextProvider} path='/runtime/context-provider' />
			<Route component={NotFound} path='*' />
		</Router>
	</div>,
)
