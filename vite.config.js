import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'unplugin-dts/vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [dts({ tsconfigPath: './tsconfig.json' })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/gl-chromakey.ts'),
      name: 'gl-chromakey',
      fileName: 'gl-chromakey',
      formats: ['es'],
    },
  },
})
