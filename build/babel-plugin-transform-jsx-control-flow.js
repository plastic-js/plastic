/**
 * babel-plugin-transform-jsx-control-flow
 *
 * Performs structural transformations on JSX control-flow components so that
 * inactive branches are never eagerly evaluated.  Each branch is lifted out of
 * the component's children and passed as a lazy arrow-function prop instead,
 * letting the runtime decide when (and whether) to call it.
 *
 * Three component shapes are handled:
 *
 *   1. <Either> — binary conditional
 *      Input:
 *        <Either condition={expr}>
 *          <True>  …content… </True>
 *          <False> …content… </False>
 *        </Either>
 *      Output:
 *        <Either condition={expr}
 *          trueBranch={()  => <True>…</True>}
 *          falseBranch={() => <False>…</False>}
 *        />
 *
 *   2. <Match> — multi-branch switch
 *      Input:
 *        <Match value={expr}>
 *          <Case when={a}>…</Case>
 *          <Case when={b}>…</Case>
 *          <Default>…</Default>
 *        </Match>
 *      Output:
 *        <Match value={expr}
 *          cases={[
 *            { when: a, branch: () => <Case when={a}>…</Case> },
 *            { when: b, branch: () => <Case when={b}>…</Case> },
 *          ]}
 *          defaultBranch={() => <Default>…</Default>}
 *        />
 *
 *   3. <Context.Provider> — context value provider
 *      Input:
 *        <MyContext.Provider value={v}>…children…</MyContext.Provider>
 *      Output:
 *        <MyContext.Provider value={v} children={() => …children…} />
 *
 * All transforms are idempotent: previously generated props (`trueBranch`,
 * `falseBranch`, `cases`, `defaultBranch`, `children`) are removed before the
 * new ones are added, so running the plugin twice is safe.
 *
 * This plugin was previously named `transform-plastic`.
 */

const plugin = function(babel){
	const { types: t } = babel

	// ---------------------------------------------------------------------------
	// Helper: extract a JSX attribute's value as a plain Babel expression
	// ---------------------------------------------------------------------------

	/**
	 * Converts a JSX attribute node into a plain Babel expression suitable for
	 * use as an object property value.
	 *
	 *  - Missing value (bare boolean attr)  → BooleanLiteral(true)
	 *  - JSXExpressionContainer             → the inner expression
	 *  - StringLiteral                      → StringLiteral (copied)
	 *  - Anything else                      → undefined (ignored)
	 */
	const getAttributeValue = (attribute)=> {
		if (!attribute || !t.isJSXAttribute(attribute)){
			return undefined
		}

		if (attribute.value == null){
			return t.booleanLiteral(true)
		}

		if (t.isJSXExpressionContainer(attribute.value)){
			return attribute.value.expression
		}

		if (t.isStringLiteral(attribute.value)){
			return t.stringLiteral(attribute.value.value)
		}

		return undefined
	}

	// ---------------------------------------------------------------------------
	// Plugin visitor
	// ---------------------------------------------------------------------------

	return {
		name: 'transform-jsx-control-flow',
		visitor: {
			JSXElement(path){
				const { openingElement, children } = path.node

				// ------------------------------------------------------------------
				// <Context.Provider> — wrap children as a lazy factory prop so
				// child JSX is not evaluated before the provider's value is in scope.
				// ------------------------------------------------------------------
				if (
					t.isJSXMemberExpression(openingElement.name) && t.isJSXIdentifier(openingElement.name.property, { name: 'Provider' })
				){
					const meaningfulChildren = children.filter(child=> !(t.isJSXText(child) && child.value.trim() === ''))

					if (meaningfulChildren.length > 0){
						// Drop any existing `children` prop to stay idempotent.
						openingElement.attributes = openingElement.attributes.filter((attribute)=> {
							if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)){
								return true
							}

							return attribute.name.name !== 'children'
						})

						// Collapse multiple children into a fragment when needed.
						const body = meaningfulChildren.length === 1 ? meaningfulChildren[0] : t.jsxFragment(t.jsxOpeningFragment(), t.jsxClosingFragment(), meaningfulChildren)

						openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('children'), t.jsxExpressionContainer(t.arrowFunctionExpression([], body))))

						path.node.children = []
					}

					return
				}

				// ------------------------------------------------------------------
				// <Either> — binary conditional: lift <True> and <False> slot
				// children into `trueBranch` / `falseBranch` arrow-function props.
				// ------------------------------------------------------------------
				if (t.isJSXIdentifier(openingElement.name, { name: 'Either' })){
					// Remove stale generated props (idempotency).
					openingElement.attributes = openingElement.attributes.filter((attribute)=> {
						if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)){
							return true
						}

						return !['trueBranch', 'falseBranch'].includes(attribute.name.name)
					})

					const trueChild = children.find(child=> t.isJSXElement(child) && t.isJSXIdentifier(child.openingElement.name, { name: 'True' }))
					const falseChild = children.find(child=> t.isJSXElement(child) && t.isJSXIdentifier(child.openingElement.name, { name: 'False' }))

					if (!trueChild && !falseChild){ return }

					if (trueChild){
						openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('trueBranch'), t.jsxExpressionContainer(t.arrowFunctionExpression([], trueChild))))
					}

					if (falseChild){
						openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('falseBranch'), t.jsxExpressionContainer(t.arrowFunctionExpression([], falseChild))))
					}

					// Slot children are now represented as props; clear them.
					path.node.children = children.filter(c=> c !== trueChild && c !== falseChild)
					return
				}

				// ------------------------------------------------------------------
				// <Match> — multi-branch switch: collect <Case> children into a
				// `cases` array and <Default> into a `defaultBranch` prop, each
				// wrapped in an arrow function so only the active branch renders.
				// ------------------------------------------------------------------
				if (!t.isJSXIdentifier(openingElement.name, { name: 'Match' })){
					return
				}

				// Remove stale generated props (idempotency).
				openingElement.attributes = openingElement.attributes.filter((attribute)=> {
					if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)){
						return true
					}

					return !['cases', 'defaultBranch'].includes(attribute.name.name)
				})

				const caseChildren = children.filter(child=> t.isJSXElement(child) && t.isJSXIdentifier(child.openingElement.name, { name: 'Case' }))
				const defaultChild = children.find(child=> t.isJSXElement(child) && t.isJSXIdentifier(child.openingElement.name, { name: 'Default' }))

				if (caseChildren.length === 0 && !defaultChild){
					return
				}

				// Build one descriptor object per Case, preserving source order.
				// `branch` is a factory so the Case's DOM is only created when active.
				// `when` carries the case predicate value for the runtime to test.
				const caseObjects = caseChildren.map((caseChild)=> {
					const whenAttribute = caseChild.openingElement.attributes.find(attribute=> t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'when' }))

					const objectFields = [
						t.objectProperty(t.identifier('branch'), t.arrowFunctionExpression([], caseChild)),
					]

					const whenValue = getAttributeValue(whenAttribute)
					if (whenValue){
						objectFields.push(t.objectProperty(t.identifier('when'), whenValue))
					}

					return t.objectExpression(objectFields)
				})

				if (caseObjects.length > 0){
					openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('cases'), t.jsxExpressionContainer(t.arrayExpression(caseObjects))))
				}

				if (defaultChild){
					openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('defaultBranch'), t.jsxExpressionContainer(t.arrowFunctionExpression([], defaultChild))))
				}

				// Slot children are now represented as props; clear them.
				path.node.children = children.filter(child=> !caseChildren.includes(child) && child !== defaultChild)
			},
		},
	}
}

export default plugin
