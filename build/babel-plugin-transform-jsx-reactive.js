/**
 * babel-plugin-transform-jsx-reactive
 *
 * Ensures that dynamic (non-static) expressions inside JSX are wrapped with
 * arrow functions so that the runtime's reactive system can track and re-run
 * them independently when their signal dependencies change.
 *
 * This replaces the older `transform-dynamic` and `transform-ternary` plugins.
 * `transform-dynamic` was a strict superset of `transform-ternary`, so they
 * are merged here into one comprehensive plugin.
 *
 * Two transforms are applied:
 *
 *   1. JSX children expressions:
 *      `<div>{someSignal()}</div>`
 *      → `<div>{() => someSignal()}</div>`
 *
 *   2. Intrinsic element attribute values (non-event, non-ref):
 *      `<input disabled={isDisabled()} />`
 *      → `<input disabled={() => isDisabled()} />`
 *
 * Expressions that are provably static (literals, identifiers, inline
 * functions, plain objects/arrays with no dynamic parts, etc.) are left
 * as-is to avoid unnecessary wrapper overhead.
 *
 * Event handler props (`onXxx`) and `ref` are excluded from attribute
 * wrapping because the runtime consumes them directly as plain values.
 */

const plugin = function(babel){
	const { types: t } = babel

	// ---------------------------------------------------------------------------
	// Helpers: classify element / prop names
	// ---------------------------------------------------------------------------

	/** Returns true when a JSX element name is an intrinsic (lower-case) HTML element. */
	const isIntrinsicElementName = name=> t.isJSXIdentifier(name) && (/^[a-z]/).test(name.name)

	/** Returns true for event handler prop names such as `onClick`, `onInput`, etc. */
	const isEventPropName = name=> (/^on[A-Z]/).test(name)

	// ---------------------------------------------------------------------------
	// Helpers: static-expression analysis
	// ---------------------------------------------------------------------------

	/**
	 * Unwraps TypeScript type-cast wrappers and parenthesized expressions to
	 * reach the underlying value node for static analysis.
	 */
	const unwrapExpression = (node)=> {
		if (t.isTSAsExpression?.(node) || t.isTSSatisfiesExpression?.(node) || t.isTSNonNullExpression?.(node) || t.isTypeCastExpression?.(node)){
			return unwrapExpression(node.expression)
		}

		if (t.isParenthesizedExpression(node)){
			return unwrapExpression(node.expression)
		}

		return node
	}

	/**
	 * Returns true when the expression is guaranteed to be stable across renders
	 * and therefore does not need a reactive wrapper.
	 *
	 * Static nodes: literals, identifiers, `this`, inline functions, JSX itself,
	 * and any composite expressions (unary, binary, template literals, arrays,
	 * objects) whose every sub-expression is also static.
	 *
	 * Dynamic nodes: anything that performs a read that may change over time —
	 * member access, function calls, `new`, `await`, `yield`, assignment, and
	 * tagged templates.
	 */
	const isStaticExpression = (input)=> {
		const node = unwrapExpression(input)

		if (!node){
			return true
		}

		// Leaf literals and stable references are always static.
		if (
			t.isStringLiteral(node) || t.isNumericLiteral(node) || t.isBooleanLiteral(node) || t.isNullLiteral(node) || t.isBigIntLiteral?.(node) || t.isRegExpLiteral?.(node) || t.isIdentifier(node) || t.isThisExpression(node) || t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)
		){
			return true
		}

		// A JSX element always implies DOM node creation — treat as dynamic.
		if (t.isJSXElement(node)){
			return false
		}

		// An empty fragment creates no DOM nodes and is stable.
		// A non-empty fragment implies DOM node creation — treat as dynamic.
		if (t.isJSXFragment(node)){
			return node.children.every(child=> t.isJSXText(child) && child.value.trim() === '')
		}

		// These node types perform reads or side-effects that can vary at runtime.
		if (
			t.isMemberExpression(node) || t.isOptionalMemberExpression?.(node) || t.isCallExpression(node) || t.isOptionalCallExpression?.(node) || t.isNewExpression(node) || t.isAwaitExpression?.(node) || t.isYieldExpression?.(node) || t.isAssignmentExpression(node) || t.isUpdateExpression(node) || t.isTaggedTemplateExpression(node)
		){
			return false
		}

		// Composite expressions: static only when all operands are static.
		if (t.isUnaryExpression(node)){
			return isStaticExpression(node.argument)
		}

		if (t.isBinaryExpression(node) || t.isLogicalExpression(node)){
			return isStaticExpression(node.left) && isStaticExpression(node.right)
		}

		if (t.isConditionalExpression(node)){
			return isStaticExpression(node.test) && isStaticExpression(node.consequent) && isStaticExpression(node.alternate)
		}

		if (t.isTemplateLiteral(node)){
			return node.expressions.every(expression=> isStaticExpression(expression))
		}

		if (t.isArrayExpression(node)){
			return node.elements.every((element)=> {
				if (!element){
					return true
				}

				if (t.isSpreadElement(element)){
					return isStaticExpression(element.argument)
				}

				return isStaticExpression(element)
			})
		}

		if (t.isObjectExpression(node)){
			return node.properties.every((property)=> {
				if (t.isSpreadElement(property)){
					// A spread may pull in dynamic values at runtime; always treat as dynamic.
					return false
				}

				// Object methods (shorthand) are always stable function definitions.
				if (t.isObjectMethod(property)){
					return true
				}

				if (!t.isObjectProperty(property)){
					return false
				}

				const isKeyStatic = property.computed ? isStaticExpression(property.key) : true
				return isKeyStatic && isStaticExpression(property.value)
			})
		}

		if (t.isSequenceExpression(node)){
			return node.expressions.every(expression=> isStaticExpression(expression))
		}

		return false
	}

	/**
	 * Returns true when `expression` is non-empty and non-static, i.e. it
	 * should be wrapped with an arrow function to defer its evaluation.
	 */
	const shouldWrapExpression = (expression)=> {
		if (!expression || t.isJSXEmptyExpression(expression)){
			return false
		}

		return !isStaticExpression(expression)
	}

	// ---------------------------------------------------------------------------
	// Plugin visitors
	// ---------------------------------------------------------------------------

	return {
		name: 'transform-jsx-reactive',
		visitor: {
			/**
			 * Wrap dynamic expressions used as JSX children.
			 *
			 * `<div>{expr}</div>` → `<div>{() => expr}</div>`
			 *
			 * Attribute containers are skipped here; they are handled in the
			 * JSXAttribute visitor below with finer-grained exclusion rules.
			 */
			JSXExpressionContainer(path){
				if (path.parentPath.isJSXAttribute()){
					return
				}

				const expression = path.get('expression')

				if (shouldWrapExpression(expression.node)){
					expression.replaceWith(t.arrowFunctionExpression([], expression.node))
				}
			},

			/**
			 * Wrap dynamic expressions on JSX element attributes (both intrinsic and
			 * component elements).
			 *
			 * `<input value={signal()} />`  → `<input value={() => signal()} />`
			 * `<Child count={state.count} />` → `<Child count={() => state.count} />`
			 *
			 * Excluded:
			 *  - Event handlers (`onXxx`) — consumed directly as function values.
			 *  - `ref` — the runtime reads it as a plain callback.
			 *  - `children` — managed separately (as JSX children or lazy factories).
			 *  - Already-static expressions — no wrapper needed.
			 */
			JSXAttribute(path){
				const attributeName = path.node.name

				if (!t.isJSXIdentifier(attributeName)){
					return
				}

				if (!t.isJSXExpressionContainer(path.node.value)){
					return
				}

				if (isEventPropName(attributeName.name) || attributeName.name === 'ref' || attributeName.name === 'children'){
					return
				}

				const expression = path.get('value.expression')
				if (!shouldWrapExpression(expression.node)){
					return
				}

				expression.replaceWith(t.arrowFunctionExpression([], expression.node))
			},
		},
	}
}

export default plugin
