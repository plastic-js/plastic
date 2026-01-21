import { defineConfig } from 'vitest/config'
import babel from 'vite-plugin-babel'
import path from 'path'

export default defineConfig({
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
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./test/setup.js'],
	},
	resolve: {
		alias: {
			'jsx/jsx-runtime': path.resolve(__dirname, './jsx-runtime.js'),
		},
	},
	esbuild: {
		loader: 'jsx',
		include: /.*\.jsx?$/,
		exclude: [],
	},
	define: {
		global: 'globalThis',
	},
})
