import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'
import path from 'path'

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
