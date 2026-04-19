import js from 'eslint-config-janus/js.js'
import mocha from 'eslint-config-janus/mocha.js'
import { jsify } from 'eslint-config-janus/utils.js'
import jsx from 'eslint-config-janus/react.js'
import globals from 'globals'

const testGlob = 'test/**/*.js'
const testTsArr = jsify(mocha, { files: [testGlob] })

export default [
	...js,
	...jsx,
	...testTsArr,
	{
		languageOptions: {
			parserOptions: {
				sourceType: 'module',
			},
			globals: {
				...globals.browser,
				__dirname: 'readonly',
			},
		},
		rules: {
			'react/prop-types': 0,
			'react/button-has-type': 0,
			'react/no-multi-comp': [2, { ignoreStateless: true }],
			// framework-specific  
			'react/destructuring-assignment': [2, 'always', { ignoreClassFields: true }],
			'@stylistic/js/no-extra-parens': [2, 'all', { ignoreJSX: 'all' }],
			'@stylistic/js/no-confusing-arrow': [2, { onlyOneSimpleParam: true }],
		},
	},
]
