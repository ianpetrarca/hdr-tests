
import { resolve } from 'path'

const root = resolve(__dirname, 'src')
const outDir = resolve(__dirname, 'dist')

export default {
  root: root,
  server:{
    host:true,
  },
  build: {
    target: 'esnext',
    outDir: outDir,
    rollupOptions: {
      input: {
        scene: resolve(root, 'index.html'),
      },
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`
      }

    },
  },
  publicDir: 'media',
  plugins: [
  ], 
};