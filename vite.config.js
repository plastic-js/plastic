import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'

export default defineConfig({
  plugins: [
    babel({
      babelConfig: {
        presets: [
          [
            '@babel/preset-react',
            {
              runtime: 'automatic',
              importSource: '.'
            }
          ]
        ]
      }
    })
  ],
  build: {
    outDir: 'dist'
  },
  server: {
    port: 3000,
    open: true
  }
})
