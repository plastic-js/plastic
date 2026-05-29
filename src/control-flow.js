import { createSignal, runUntracked } from './reactivity.js'
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
	appendChild,
	flushPendingDescriptors,
})=> {
	// Reactively replaces DOM content after a comment anchor.
	// selectBranch() runs tracked - it should read condition signals and return
	// a *branch factory* (or null) identifying which branch to render. The DOM
	// is only torn down and rebuilt when that factory identity changes, so signal
	// churn that doesn't flip the branch is a no-op (matches Solid's <Show>).
	const NO_BRANCH = Symbol('no-branch')

	const mountDynamic = (anchor, selectBranch)=> {
		let prevNodes = []
		let prevOwner = null
		let prevBranch = NO_BRANCH
		// Capture the Either component's owner at call time so branch owners are always
		// parented correctly even when the effect re-runs outside component context.
		const hostOwner = getCurrentOwner()

		const update = ()=> {
			const branch = selectBranch()
			if (branch === prevBranch){
				return
			}
			prevBranch = branch

			if (prevOwner){
				disposeOwner(prevOwner)
				prevOwner = null
			}
			prevNodes.forEach(n=> n.remove())
			prevNodes = []

			const owner = createOwner(hostOwner)
			const prevComp = getCurrentComputation()
			setCurrentComputation(null)
			// Branch invocation runs untracked: the selection above already
			// subscribed to the discriminator, and the branch's own bindings
			// will set up their effects under `owner`. Letting them auto-link
			// into the outer binding effect would re-trigger this update on
			// every internal signal change and rebuild the DOM unnecessarily.
			const result = runUntracked(()=> runWithOwner(owner, ()=> (
				typeof branch === 'function' ? branch() : null
			)))
			const node = renderInOwner(owner, result ?? null)
			setCurrentComputation(prevComp)

			// When the branch returns an array (e.g. items.map(...) or spread
			// children), node2Element defers component descriptors onto the
			// DocumentFragment without flushing them.  Flush here with the
			// branch owner so deferred children materialize in the DOM instead
			// of remaining as silent placeholder comments.
			if (node instanceof DocumentFragment && flushPendingDescriptors){
				runWithOwner(owner, ()=> flushPendingDescriptors(node))
			}

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
	const Case = ({ children })=> children
	const Default = ({ children })=> children

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
			return cond ? activeTrue : activeFalse
		})

		return fragment
	}

	// <Match value={...}>
	//   <Case when={...}>...</Case>
	//   <Default>...</Default>
	// </Match>
	//
	// The Babel plugin rewrites Case/Default children into lazy factory props:
	//   cases=[{ when, branch: () => <Case>...</Case> }, ...]
	//   defaultBranch={() => <Default>...</Default>}
	const Match = ({
		value,
		cases = [],
		defaultBranch,
	})=> {
		const anchor = document.createComment('match')
		const fragment = document.createDocumentFragment()
		fragment.appendChild(anchor)

		const resolve = (source)=> {
			return typeof source === 'function' ? source() : source
		}

		mountDynamic(anchor, ()=> {
			const activeCases = Array.isArray(cases) ? cases : []
			const valueToMatch = resolve(value)

			for (const slot of activeCases){
				if (!slot || typeof slot !== 'object'){
					continue
				}

				let matched = false
				if (Object.prototype.hasOwnProperty.call(slot, 'when')){
					matched = Object.is(valueToMatch, resolve(slot.when))
				}

				if (!matched){
					continue
				}

				return typeof slot.branch === 'function' ? slot.branch : null
			}

			return typeof defaultBranch === 'function' ? defaultBranch : null
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
			// runUntracked mirrors materializeComponentDescriptor: the row's binding
			// effects belong to its own owner, so they must not auto-link as deps of
			// the surrounding Loop binding effect. Otherwise Loop's purgeDeps on re-run
			// would unwatch them and sever their signal subscriptions.
			const result = runUntracked(()=> runWithOwner(owner, ()=> {
				if (typeof children !== 'function'){
					return null
				}

				return children(item, indexSignal)
			}))
			const node = runUntracked(()=> renderInOwner(owner, result))
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

	// <Portal container={el}>...</Portal>
	//
	// Renders children into `container` (defaults to document.body) instead of
	// the component's position in the tree. A comment node is left as a placeholder
	// so the surrounding component tree is not disturbed.
	// All child owners, effects, and event listeners are disposed when the host
	// component unmounts via the registerCleanup call below.
	const Portal = ({ container, children })=> {
		const target = (typeof container === 'function' ? container() : container) ?? document.body

		const hostOwner = getCurrentOwner()
		const owner = createOwner(hostOwner)

		const prevComp = getCurrentComputation()
		setCurrentComputation(null)
		const result = runWithOwner(owner, ()=> typeof children === 'function' ? children() : children)
		const node = renderInOwner(owner, result ?? null)
		setCurrentComputation(prevComp)

		const childCountBefore = target.childNodes.length

		if (node instanceof DocumentFragment && appendChild){
			appendChild(target, node)
		} else {
			target.appendChild(node)
		}

		if (flushPendingDescriptors){
			flushPendingDescriptors(target)
		}

		const portalNodes = [...target.childNodes].slice(childCountBefore)

		if (target.isConnected){
			runOwnerMounts(owner)
		}

		registerCleanup(()=> {
			disposeOwner(owner)
			portalNodes.forEach(n=> n.remove())
		})

		return document.createComment('portal')
	}

	return {
		mountDynamic,
		Either,
		True,
		False,
		Match,
		Case,
		Default,
		Loop,
		Portal,
	}
}

export {
	createControlFlow,
}
