import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'
import path from 'path'
import plasticJsx from 'babel-preset-plastic'

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
							importSource: '@plastic-js/plastic',
						},
					],
					plasticJsx,
				],
			},
		}),
	],
	resolve: {
		alias: {
			'@plastic-js/plastic/jsx-runtime': path.resolve(__dirname, './src/jsx-runtime.js'),
			'@plastic-js/plastic': path.resolve(__dirname, './src/index.js'),
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
		exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
		setupFiles: ['./test/setup.js'],
	},
})
