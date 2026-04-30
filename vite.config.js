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
							importSource: 'jsx',
						},
					],
				],
				plugins: [babelReactive, babelControlFlow],
			},
		}),
	],
	resolve: {
		alias: {
			'jsx/jsx-runtime': path.resolve(__dirname, './src/jsx-runtime.js'),
		},
	},
	build: {
		outDir: '../dist',
	},
	server: {
		port: 3000,
		open: true,
	},
})
