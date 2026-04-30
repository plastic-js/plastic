import { Link, Outlet } from '../../src/index.js'

const PageOne = ()=> (
	<div className='checklist'>
		<h3>Page One</h3>
		<p>This is the first page. It contains a nested router for its own sub-routes.</p>
		<div style={{ display: 'flex', gap: '12px', margin: '8px 0' }}>
			<Link style={{ textDecoration: 'none' }} to='/page-one'>Default (index)</Link>
			<Link style={{ textDecoration: 'none' }} to='/page-one/sub-a'>Sub-page A</Link>
			<Link style={{ textDecoration: 'none' }} to='/page-one/sub-b'>Sub-page B</Link>
		</div>
		<Outlet />
	</div>
)

export default PageOne
