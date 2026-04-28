const plugin = function(babel){
	const { types: t } = babel

	return {
		name: 'transform-jsx-either',
		visitor: {
			// Transform <Either condition={...}><True>…</True><False>…</False></Either>
			// into     <Either condition={...} trueBranch={() => <True>…</True>} falseBranch={() => <False>…</False>} />
			// so that the inactive branch is never evaluated until it becomes active.
			JSXElement(path){
				const { openingElement, children } = path.node

				if (!t.isJSXIdentifier(openingElement.name, { name: 'Either' })){ return }

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
			},
		},
	}
}

export default plugin
