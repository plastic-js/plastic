// let's test the onMount lifecycle method
import { onCleanup, onMount } from '../jsx-runtime.js'

const Label = (props)=> {
	onMount(()=> {
		console.log('Label mounted with text:', props.text)
	})
	onCleanup(()=> {
		console.log('Label unmounted with text:', props.text)
	})
	return (
		<label>
			{props.text}
		</label>
	)
}

export default Label
