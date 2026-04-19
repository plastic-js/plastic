const plugin = function(babel){
	const { types: t } = babel

	return {
		name: 'transform-jsx-ternary-to-function',
		visitor: {
			JSXExpressionContainer(path){
				const expression = path.get('expression')

				if (expression.isConditionalExpression()){
					const arrowFunction = t.arrowFunctionExpression([], expression.node)

					expression.replaceWith(arrowFunction)
				}
			},
		},
	}
}

export default plugin
