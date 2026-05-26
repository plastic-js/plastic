import { defineConfig } from 'vite'
import path from 'path'

const here = path.resolve(__dirname)

export default defineConfig({
	root: here,
	resolve: {
		alias: {
			'@plastic-js/plastic/jsx-runtime': path.resolve(here, '../src/jsx-runtime.js'),
			'@plastic-js/plastic': path.resolve(here, '../src/index.js'),
		},
	},
	server: { port: 4174 },
})
