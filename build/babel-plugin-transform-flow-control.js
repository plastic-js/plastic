const plugin = function(babel){
	const { types: t } = babel

	// Normalize JSX attribute values into plain Babel expressions so Match case
	// objects can carry either literals, expression containers, or bare booleans.
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

	return {
		name: 'transform-jsx-flow-control',
		visitor: {
			// Transform <Either condition={...}><True>…</True><False>…</False></Either>
			// into     <Either condition={...} trueBranch={() => <True>…</True>} falseBranch={() => <False>…</False>} />
			// so that the inactive branch is never evaluated until it becomes active.
			JSXElement(path){
				const { openingElement, children } = path.node

				if (t.isJSXIdentifier(openingElement.name, { name: 'Either' })){
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

					// Remove True/False from children — they are now factory props
					path.node.children = children.filter(c=> c !== trueChild && c !== falseChild)
					return
				}

				if (!t.isJSXIdentifier(openingElement.name, { name: 'Match' })){
					return
				}

				// Remove any previously generated props to make the transform idempotent.
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

				// Build `cases` objects in source order and keep each branch lazy so
				// inactive Case children are never eagerly created at runtime.
				const caseObjects = caseChildren.map((caseChild)=> {
					const whenAttribute = caseChild.openingElement.attributes.find(attribute=> t.isJSXAttribute(attribute) && t.isJSXIdentifier(attribute.name, { name: 'when' }))
					const objectFields = [t.objectProperty(t.identifier('branch'), t.arrowFunctionExpression([], caseChild))]

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

				// Remove transformed slot children because they are now represented by
				// `cases` / `defaultBranch` factory props.
				path.node.children = children.filter(child=> !caseChildren.includes(child) && child !== defaultChild)
			},
		},
	}
}

export default plugin
