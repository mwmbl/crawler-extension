import { dirname, relative } from 'path'
import { defineConfig,  } from 'vite'
import { r, port, isDev } from './scripts/utils';

export default defineConfig(({ command }) => ({
  root: r('src'),
  publicDir: r('public'),
  define: {
    __DEV__: isDev,
  },
  resolve: {
    alias: {
      '~/': `${r('src')}/`,
    },
  },
  base: '/',
  server: {
    port,
    hmr: {
      host: 'localhost',
    },
  },
  build: {
    outDir: r('dist'),
    emptyOutDir: false,
    minify: false,
    sourcemap: isDev ? 'inline' : false,
    // https://developer.chrome.com/docs/webstore/program_policies/#:~:text=Code%20Readability%20Requirements
    terserOptions: {
      mangle: false,
    },
    rollupOptions: {
      input: {
        worker: r('src/worker.js'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        inlineDynamicImports: false
      }
    },
  },
}));
