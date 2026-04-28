import { createSignal } from './reactivity.js'
import { getCurrentComputation, setCurrentComputation } from './computation-context.js'

const createControlFlow = ({
	createOwner,
	runOwnerMounts,
	runWithOwner,
	disposeOwner,
	createBindingEffect,
	renderInOwner,
	getCurrentOwner,
	registerCleanup,
})=> {
	// Reactively replaces DOM content after a comment anchor.
	// getContent() is called inside a binding effect - any signals it reads
	// will trigger a branch switch when they change.
	// On each switch: the previous branch owner is disposed (cleaning up all its
	// effects and event listeners), its DOM nodes are removed, and the new branch
	// is rendered in a fresh child owner.
	const mountDynamic = (anchor, getContent)=> {
		let prevNodes = []
		let prevOwner = null
		// Capture the Either component's owner at call time so branch owners are always
		// parented correctly even when the effect re-runs outside component context.
		const hostOwner = getCurrentOwner()

		const update = ()=> {
			if (prevOwner){
				disposeOwner(prevOwner)
				prevOwner = null
			}
			prevNodes.forEach(n=> n.remove())
			prevNodes = []

			const owner = createOwner(hostOwner)
			const prevComp = getCurrentComputation()
			setCurrentComputation(null)
			const result = runWithOwner(owner, getContent)
			const node = renderInOwner(owner, result ?? null)
			setCurrentComputation(prevComp)

			// Collect child refs before insertion: DocumentFragment drains on append.
			if (node instanceof DocumentFragment){
				prevNodes = [...node.childNodes]
			} else {
				prevNodes = [node]
			}

			anchor.after(node)
			prevOwner = owner

			// For reactive updates (anchor already in live DOM), trigger mount hooks now.
			// For the initial render, renderApp will call runOwnerMounts on the full tree.
			if (anchor.isConnected){
				runOwnerMounts(owner)
			}
		}

		const stop = createBindingEffect(update)

		return ()=> {
			if (typeof stop === 'function'){
				stop()
			}
			if (prevOwner){
				disposeOwner(prevOwner)
				prevOwner = null
			}
			prevNodes.forEach(n=> n.remove())
			prevNodes = []
		}
	}

	// <True> and <False> are transparent slot markers - they pass children through.
	// The Babel plugin wraps them in lazy arrow functions before Either ever sees them,
	// so the inactive branch is never evaluated until needed.
	const True = ({ children })=> children
	const False = ({ children })=> children

	// <Either condition={...}>
	//   <True>...</True>
	//   <False>...</False>
	// </Either>
	//
	// The Babel plugin transforms this into:
	//   <Either condition={...} trueBranch={() => <True>...</True>} falseBranch={() => <False>...</False>} />
	// so branches are only rendered when active.
	const Either = ({
		condition, trueBranch, falseBranch,
	})=> {
		const anchor = document.createComment('if')
		// Return a fragment so the anchor and initial branch content land in the
		// parent as siblings. anchor.after() keeps working once in the live DOM.
		const fragment = document.createDocumentFragment()
		fragment.appendChild(anchor)
		const activeTrue = trueBranch
		const activeFalse = falseBranch

		mountDynamic(anchor, ()=> {
			const cond = typeof condition === 'function' ? condition() : condition
			const branch = cond ? activeTrue : activeFalse
			return branch ? branch() : null
		})

		return fragment
	}

	// <Loop each={items}>{(item, index) => ...}</Loop>
	//
	// Rows are tracked by identity (object reference / primitive value).
	const Loop = ({
		each,
		children,
	})=> {
		const anchor = document.createComment('for')
		const fragment = document.createDocumentFragment()
		fragment.appendChild(anchor)

		const hostOwner = getCurrentOwner()
		let rows = []

		const resolveList = ()=> {
			const list = typeof each === 'function' ? each() : each
			return Array.isArray(list) ? list : []
		}

		const renderRow = (item, indexValue)=> {
			const owner = createOwner(hostOwner)
			const indexSignal = createSignal(indexValue)
			const prevComp = getCurrentComputation()
			setCurrentComputation(null)
			const result = runWithOwner(owner, ()=> {
				if (typeof children !== 'function'){
					return null
				}

				return children(item, indexSignal)
			})
			const node = renderInOwner(owner, result)
			setCurrentComputation(prevComp)
			const nodes = node instanceof DocumentFragment ? [...node.childNodes] : [node]

			return {
				owner,
				indexSignal,
				nodes,
			}
		}

		const mountRows = (nextRows)=> {
			const nodeFragment = document.createDocumentFragment()
			nextRows.forEach((row)=> {
				row.nodes.forEach((node)=> {
					nodeFragment.appendChild(node)
				})
			})
			anchor.before(nodeFragment)
		}

		const reconcileRows = (nextItems)=> {
			const prevRows = rows
			const nextRows = new Array(nextItems.length)
			const createdRows = []
			const reusedPrevIndices = new Set()

			// Build lookup: identity -> [prevIndex, ...] (buckets handle duplicates).
			const prevRowsByIdentity = new Map()
			prevRows.forEach((row, prevIndex)=> {
				const bucket = prevRowsByIdentity.get(row.identity)
				if (bucket){
					bucket.push(prevIndex)
				} else {
					prevRowsByIdentity.set(row.identity, [prevIndex])
				}
			})

			// Match existing rows by identity.
			nextItems.forEach((item, nextIndex)=> {
				const bucket = prevRowsByIdentity.get(item)
				if (!bucket || bucket.length === 0){
					return
				}

				const prevIndex = bucket.shift()
				nextRows[nextIndex] = prevRows[prevIndex]
				reusedPrevIndices.add(prevIndex)
			})

			// Create missing rows.
			for (let nextIndex = 0; nextIndex < nextRows.length; nextIndex++){
				const row = nextRows[nextIndex]
				if (row){
					row.indexSignal(nextIndex)
					continue
				}

				const created = renderRow(nextItems[nextIndex], nextIndex)
				created.identity = nextItems[nextIndex]
				nextRows[nextIndex] = created
				createdRows.push(created)
			}

			// Dispose rows that were not reused.
			prevRows.forEach((row, prevIndex)=> {
				if (reusedPrevIndices.has(prevIndex)){
					return
				}

				disposeOwner(row.owner)
				row.nodes.forEach(node=> node.remove())
			})

			rows = nextRows
			mountRows(rows)

			if (anchor.isConnected){
				createdRows.forEach((row)=> {
					runOwnerMounts(row.owner)
				})
			}
		}

		const stop = createBindingEffect(()=> {
			const nextItems = resolveList()
			reconcileRows(nextItems)
		})

		registerCleanup(()=> {
			if (typeof stop === 'function'){
				stop()
			}

			rows.forEach((row)=> {
				disposeOwner(row.owner)
				row.nodes.forEach(node=> node.remove())
			})
			rows = []
		})

		return fragment
	}

	return {
		mountDynamic,
		Either,
		True,
		False,
		Loop,
	}
}

export {
	createControlFlow,
}
