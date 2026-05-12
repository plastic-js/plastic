import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'
import path from 'path'
import babelReactive from './build/babel-plugin-transform-jsx-reactive.js'
import babelControlFlow from './build/babel-plugin-transform-jsx-control-flow.js'

export default defineConfig({
	root: 'showcase',
	plugins: [
		babel({
			babelConfig: {
				presets: [
					[
						'@babel/preset-react',
						{
							runtime: 'automatic',
							importSource: 'plastic',
						},
					],
				],
				// Control-flow plugin runs first so its synthesized branch/case
				// attributes flow through the reactive plugin's mergeProps rewrite.
				plugins: [babelControlFlow, babelReactive],
			},
		}),
	],
	resolve: {
		alias: {
			'plastic/jsx-runtime': path.resolve(__dirname, './src/jsx-runtime.js'),
			plastic: path.resolve(__dirname, './src/index.js'),
		},
	},
	build: {
		outDir: '../dist',
	},
	server: {
		port: 3000,
		open: true,
	},
	test: {
		// ark-solid and zag-solid are Solid.js reference ports; their tsconfigs
		// extend non-existent monorepo paths and they require a Solid runtime
		// the Plastic test suite does not provide.
		exclude: ['**/node_modules/**', '**/dist/**', 'ark-solid/**', 'zag-solid/**'],
		// Stubs IntersectionObserver/ResizeObserver/CSS.escape/Element.scrollTo
		// for jsdom so zag-js machines (carousel, drawer, popper, select,
		// radio-group, etc.) can wire up without crashing.
		setupFiles: ['./test/setup.js'],
	},
})
