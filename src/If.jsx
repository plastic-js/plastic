// an If component which will add a comment node in the DOM, only when the condition is satisfied, the actual component will be rendered
const If = (props)=> {
	return (
		<solid_if when={props.when}>
			{props.children}
		</solid_if>
	)
}

export default If
