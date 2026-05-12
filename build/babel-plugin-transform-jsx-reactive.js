/**
 * babel-plugin-transform-jsx-reactive
 *
 * Rewrites each JSX element's attribute list and children into a single
 * `mergeProps(...)` call so that the runtime sees one reactive proxy per
 * element, regardless of how many spreads or sibling attributes appear.
 *
 *   <MyComp {...api()} foo={2} bar={state.b}>{kid}</MyComp>
 *   →
 *   <MyComp {...mergeProps(api(), {
 *     foo: 2,
 *     get bar() { return state.b },
 *     get children() { return kid }
 *   })} />
 *
 * `mergeProps` returns a Proxy: reading `proxy.bar` invokes the getter, which
 * is where the reactive system observes signal reads. Static expressions
 * (literals, identifiers, inline functions, etc.) are emitted as plain values
 * so they incur no proxy overhead.
 *
 * Consecutive non-spread attributes are grouped into one object literal;
 * spread attributes are passed through as positional arguments to mergeProps,
 * preserving JSX prop-order semantics (later sources override earlier ones
 * for normal keys; class/style/ref/onXxx have their own merge rules in
 * `src/merge-props.js`).
 *
 * Children are injected as a `get children()` getter on the trailing object
 * group so the proxy stays the sole carrier of element data — the JSX is
 * emitted as self-closing, so `@babel/preset-react`'s automatic runtime
 * produces `jsx(Tag, mergeProps(...))` directly without re-spreading.
 *
 * Dynamic event handlers no longer need a compile-time indirection wrapper:
 * the runtime's `applyProps` attaches a single listener that resolves the
 * handler via the proxy at call time, so changing the handler reference is
 * picked up naturally.
 */

const plugin = function(babel){
	const { types: t } = babel

	// ---------------------------------------------------------------------------
	// Static-expression analysis: identical to the previous plugin so that
	// already-stable values continue to be emitted as plain object properties
	// rather than getters.
	// ---------------------------------------------------------------------------

	const unwrapExpression = (node)=> {
		if (t.isTSAsExpression?.(node) || t.isTSSatisfiesExpression?.(node) || t.isTSNonNullExpression?.(node) || t.isTypeCastExpression?.(node)){
			return unwrapExpression(node.expression)
		}
		if (t.isParenthesizedExpression(node)){
			return unwrapExpression(node.expression)
		}
		return node
	}

	const isStaticExpression = (input)=> {
		const node = unwrapExpression(input)
		if (!node){
			return true
		}

		if (
			t.isStringLiteral(node) || t.isNumericLiteral(node) || t.isBooleanLiteral(node) || t.isNullLiteral(node) || t.isBigIntLiteral?.(node) || t.isRegExpLiteral?.(node) || t.isIdentifier(node) || t.isThisExpression(node) || t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)
		){
			return true
		}

		if (t.isJSXElement(node)){
			return false
		}

		if (t.isJSXFragment(node)){
			return node.children.every(child=> t.isJSXText(child) && child.value.trim() === '')
		}

		if (
			t.isMemberExpression(node) || t.isOptionalMemberExpression?.(node) || t.isCallExpression(node) || t.isOptionalCallExpression?.(node) || t.isNewExpression(node) || t.isAwaitExpression?.(node) || t.isYieldExpression?.(node) || t.isAssignmentExpression(node) || t.isUpdateExpression(node) || t.isTaggedTemplateExpression(node)
		){
			return false
		}

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
					return false
				}
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

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	// Tracks JSX nodes we have already rewritten so the visitor does not re-enter
	// them after we replace their attributes / children. Babel continues
	// traversing into the mutated subtree, which would otherwise loop.
	const rewritten = new WeakSet()

	// Convert a JSX child node into a plain expression. Dynamic JSXExpression
	// children are wrapped in a thunk so the runtime's `appendChild` /
	// `node2Element` path detects them and creates a reactive child node —
	// preserving per-child re-render granularity from the previous design.
	// JSXElement children are left as-is; this plugin's own visitor rewrites
	// them into structural `_jsx(...)` calls (one DOM instance, no wrapping).
	const jsxChildToExpression = (child)=> {
		if (t.isJSXText(child)){
			const trimmed = child.value.replace(/\s+/g, ' ')
			if (!trimmed.trim()){
				return null
			}
			return t.stringLiteral(trimmed)
		}
		if (t.isJSXExpressionContainer(child)){
			if (t.isJSXEmptyExpression(child.expression)){
				return null
			}
			const expr = child.expression
			if (isStaticExpression(expr)){
				return expr
			}
			return t.arrowFunctionExpression([], expr)
		}
		if (t.isJSXSpreadChild(child)){
			return t.spreadElement(child.expression)
		}
		return child
	}

	// Build the literal property key for an attribute name. JSX allows
	// `aria-foo`, `data-bar`, namespaced names like `xlink:href`, etc., none of
	// which are valid JS identifiers — emit them as string literals.
	const jsxNameToKey = (jsxName)=> {
		if (t.isJSXIdentifier(jsxName)){
			const name = jsxName.name
			if ((/^[a-zA-Z_$][\w$]*$/).test(name)){
				return { key: t.identifier(name), computed: false, name }
			}
			return { key: t.stringLiteral(name), computed: false, name }
		}
		if (t.isJSXNamespacedName(jsxName)){
			const name = `${jsxName.namespace.name}:${jsxName.name.name}`
			return { key: t.stringLiteral(name), computed: false, name }
		}
		// Fallback — unreachable for valid JSX.
		return { key: t.stringLiteral(String(jsxName)), computed: false, name: String(jsxName) }
	}

	// Build the value expression for a JSXAttribute.
	const jsxAttrValueToExpression = (attr)=> {
		if (attr.value == null){
			// `<input disabled />` → `disabled: true`
			return t.booleanLiteral(true)
		}
		if (t.isStringLiteral(attr.value)){
			return attr.value
		}
		if (t.isJSXExpressionContainer(attr.value)){
			if (t.isJSXEmptyExpression(attr.value.expression)){
				return t.identifier('undefined')
			}
			return attr.value.expression
		}
		if (t.isJSXElement(attr.value) || t.isJSXFragment(attr.value)){
			return attr.value
		}
		return attr.value
	}

	// Construct an ObjectExpression from a list of JSXAttributes (non-spread),
	// plus an optional synthetic `children` source.
	const buildObjectExpression = (jsxAttrs, syntheticChildren)=> {
		const properties = []

		for (const attr of jsxAttrs){
			const { key, computed, name } = jsxNameToKey(attr.name)
			const value = jsxAttrValueToExpression(attr)

			if (isStaticExpression(value)){
				properties.push(t.objectProperty(key, value, computed))
				continue
			}

			// Dynamic: emit as a getter so reading the proxy invokes the expression
			// inside the current tracking scope.
			const getter = t.objectMethod('get', key, [], t.blockStatement([
				t.returnStatement(value),
			]), computed)
			properties.push(getter)

			// `name` is unused but kept for potential future special-case logic
			// (e.g. always-static names like `key`).
			void name
		}

		if (syntheticChildren && syntheticChildren.length > 0){
			const childExprs = syntheticChildren.map(jsxChildToExpression).filter(Boolean)
			if (childExprs.length > 0){
				const key = t.identifier('children')
				const value = childExprs.length === 1 && !t.isSpreadElement(childExprs[0])
					? childExprs[0]
					: t.arrayExpression(childExprs)
				properties.push(t.objectProperty(key, value))
			}
		}

		return t.objectExpression(properties)
	}

	// Group attributes so that consecutive non-spread attributes form one
	// ObjectExpression while spreads remain positional. Children are attached
	// to the trailing object group (creating one if necessary).
	const buildMergePropsArgs = (jsxAttrs, jsxChildren)=> {
		const groups = []
		for (const attr of jsxAttrs){
			if (t.isJSXSpreadAttribute(attr)){
				groups.push({ kind: 'spread', node: attr.argument })
			} else {
				const last = groups[groups.length - 1]
				if (last && last.kind === 'object'){
					last.attrs.push(attr)
				} else {
					groups.push({ kind: 'object', attrs: [attr] })
				}
			}
		}

		const meaningfulChildren = jsxChildren.filter((child)=> {
			if (t.isJSXText(child)){
				return child.value.replace(/\s+/g, ' ').trim() !== ''
			}
			if (t.isJSXExpressionContainer(child) && t.isJSXEmptyExpression(child.expression)){
				return false
			}
			return true
		})

		if (meaningfulChildren.length > 0){
			const last = groups[groups.length - 1]
			if (last && last.kind === 'object'){
				last.syntheticChildren = meaningfulChildren
			} else {
				groups.push({ kind: 'object', attrs: [], syntheticChildren: meaningfulChildren })
			}
		}

		return groups.map((group)=> {
			if (group.kind === 'spread'){
				// Dynamic spread sources (e.g. `{...api()}`) must be wrapped in a
				// thunk so `mergeProps` can re-evaluate them when their signal
				// dependencies change. Static sources (object literals, plain
				// identifiers) are passed through directly.
				if (isStaticExpression(group.node)){
					return group.node
				}
				return t.arrowFunctionExpression([], group.node)
			}
			return buildObjectExpression(group.attrs, group.syntheticChildren)
		})
	}

	// Ensure the file imports `name` from `plastic/jsx-runtime`. In module mode,
	// adds an ImportSpecifier (re-using one if present). In script mode (tests
	// that pass code through `new Function`), returns a bare identifier of the
	// same name; the test harness is responsible for providing that binding.
	const ensureRuntimeImport = (path, name)=> {
		const program = path.findParent(p=> p.isProgram()) ?? path.hub?.file?.path
		if (!program){
			return t.identifier(name)
		}
		if (program.node.sourceType !== 'module'){
			return t.identifier(name)
		}

		const cacheKey = `runtimeImport:${name}`
		const cachedId = program.getData(cacheKey)
		if (cachedId){
			return t.identifier(cachedId)
		}

		for (const stmt of program.node.body){
			if (!t.isImportDeclaration(stmt)){
				continue
			}
			if (stmt.source.value !== 'plastic/jsx-runtime'){
				continue
			}
			for (const specifier of stmt.specifiers){
				if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported, { name })){
					program.setData(cacheKey, specifier.local.name)
					return t.identifier(specifier.local.name)
				}
			}
			const local = program.scope.generateUidIdentifier(name)
			stmt.specifiers.push(t.importSpecifier(local, t.identifier(name)))
			program.setData(cacheKey, local.name)
			return t.identifier(local.name)
		}

		const local = program.scope.generateUidIdentifier(name)
		const importDecl = t.importDeclaration(
			[t.importSpecifier(local, t.identifier(name))],
			t.stringLiteral('plastic/jsx-runtime'),
		)
		program.unshiftContainer('body', importDecl)
		program.setData(cacheKey, local.name)
		return t.identifier(local.name)
	}

	// Resolve the object part of a JSXMemberExpression to a JS expression.
	// Unlike the standalone tag case, every node here references a JS value
	// chain (e.g. `Theme.Provider`, `ark.div`), so a leading lowercase
	// identifier is still a variable reference — never an intrinsic string.
	const jsxMemberObjectToExpression = (node)=> {
		if (t.isJSXIdentifier(node)){
			return t.identifier(node.name)
		}
		if (t.isJSXMemberExpression(node)){
			return t.memberExpression(jsxMemberObjectToExpression(node.object), t.identifier(node.property.name))
		}
		return t.identifier(String(node))
	}

	// Convert a JSXOpeningElement's tag name to a JS expression suitable as the
	// first argument of `jsx(...)`. Standalone lower-case identifiers become
	// string literals (intrinsic DOM tags); upper-case identifiers, namespaced
	// names, and member expressions become references to the corresponding
	// component / namespaced tag.
	const jsxTagToExpression = (name)=> {
		if (t.isJSXIdentifier(name)){
			if ((/^[a-z]/).test(name.name)){
				return t.stringLiteral(name.name)
			}
			return t.identifier(name.name)
		}
		if (t.isJSXMemberExpression(name)){
			return t.memberExpression(jsxMemberObjectToExpression(name.object), t.identifier(name.property.name))
		}
		if (t.isJSXNamespacedName(name)){
			return t.stringLiteral(`${name.namespace.name}:${name.name.name}`)
		}
		return t.identifier(String(name))
	}

	return {
		name: 'transform-jsx-reactive',
		visitor: {
			JSXElement(path){
				const node = path.node
				if (rewritten.has(node)){
					return
				}
				rewritten.add(node)

				const opening = node.openingElement
				const attrs = opening.attributes
				const children = node.children

				const tagExpr = jsxTagToExpression(opening.name)
				const args = buildMergePropsArgs(attrs, children)

				// No attrs and no meaningful children → emit jsx(Tag, {}) directly.
				let propsExpr
				if (args.length === 0){
					propsExpr = t.objectExpression([])
				} else {
					const mergeId = ensureRuntimeImport(path, 'mergeProps')
					propsExpr = t.callExpression(mergeId, args)
				}

				const jsxId = ensureRuntimeImport(path, 'jsx')
				path.replaceWith(t.callExpression(jsxId, [tagExpr, propsExpr]))
			},

			// Fragments don't go through mergeProps (no attributes), but dynamic
			// expression children inside a fragment still need wrapping to remain
			// reactive — emit `jsx(Fragment, { children: [...] })` with getters for
			// dynamic children.
			JSXFragment(path){
				const node = path.node
				if (rewritten.has(node)){
					return
				}
				rewritten.add(node)

				const children = node.children
				const meaningfulChildren = children.filter((child)=> {
					if (t.isJSXText(child)){
						return child.value.replace(/\s+/g, ' ').trim() !== ''
					}
					if (t.isJSXExpressionContainer(child) && t.isJSXEmptyExpression(child.expression)){
						return false
					}
					return true
				})

				let propsExpr
				if (meaningfulChildren.length === 0){
					propsExpr = t.objectExpression([])
				} else {
					const obj = buildObjectExpression([], meaningfulChildren)
					const mergeId = ensureRuntimeImport(path, 'mergeProps')
					propsExpr = t.callExpression(mergeId, [obj])
				}

				const jsxId = ensureRuntimeImport(path, 'jsx')
				const fragmentId = ensureRuntimeImport(path, 'Fragment')
				path.replaceWith(t.callExpression(jsxId, [fragmentId, propsExpr]))
			},
		},
	}
}

export default plugin
