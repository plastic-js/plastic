import { Link, Outlet } from '../../src/index.js'

const PageTwo = ()=> (
	<div className='checklist'>
		<h3>Page Two</h3>
		<p>This is the second page. It contains a nested router for its own sub-routes.</p>
		<div style={{
			display: 'flex', gap: '12px', margin: '8px 0',
		}}
		>
			<Link style={{ textDecoration: 'none' }} to='/page-two'>404 (*)</Link>
			<Link style={{ textDecoration: 'none' }} to='/page-two/sub-a'>Sub-page A</Link>
			<Link style={{ textDecoration: 'none' }} to='/page-two/sub-b'>Sub-page B</Link>
		</div>
		<Outlet />
	</div>
)

export default PageTwo
