import { defineConfig } from 'vite'
import path from 'path'
import babel from 'vite-plugin-babel'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import solid from 'vite-plugin-solid'
import babelReactive from 'babel-preset-plastic/reactive'
import babelControlFlow from 'babel-preset-plastic/control-flow'

const here = path.resolve(__dirname)

// Each framework's JSX gets a different transform.
// Scope each plugin to its subfolder so they don't trample each other.
const plasticFilter = (id)=> id.includes('/bench-e2e/plastic/') && /\.jsx?$/.test(id)
const reactFilter = /bench-e2e\/react\/.*\.jsx?$/
const solidFilter = /bench-e2e\/solid\/.*\.jsx?$/

export default defineConfig({
	root: here,
	plugins: [
		babel({
			filter: plasticFilter,
			babelConfig: {
				presets: [
					['@babel/preset-react', { runtime: 'automatic', importSource: '@plastic-js/plastic' }],
				],
				plugins: [babelControlFlow, babelReactive],
			},
		}),
		react({ include: reactFilter }),
		solid({ include: solidFilter }),
		vue(),
	],
	resolve: {
		alias: {
			'@plastic-js/plastic/jsx-runtime': path.resolve(here, '../src/jsx-runtime.js'),
			'@plastic-js/plastic': path.resolve(here, '../src/index.js'),
		},
	},
	server: { port: 4173 },
	build: {
		rollupOptions: {
			input: {
				plastic: path.resolve(here, 'plastic/index.html'),
				react: path.resolve(here, 'react/index.html'),
				vue: path.resolve(here, 'vue/index.html'),
				solid: path.resolve(here, 'solid/index.html'),
			},
		},
	},
})
