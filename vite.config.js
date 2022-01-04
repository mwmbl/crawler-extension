import { dirname, relative } from 'path'
import { defineConfig,  } from 'vite'
import { r, port, isDev } from './scripts/utils';

export default defineConfig(({ command }) => ({
  root: r('src'),
  define: {
    __DEV__: isDev,
  },
  resolve: {
    alias: {
      '~/': `${r('src')}/`,
    },
  },
  base: command === 'serve' ? `http://localhost:${port}/` : '/dist/',
  server: {
    port,
    hmr: {
      host: 'localhost',
    },
  },
  plugins: [
    // rewrite assets to use relative path
    {
      name: 'assets-rewrite',
      enforce: 'post',
      apply: 'build',
      transformIndexHtml(html, { path }) {
        return html.replace(/"\/assets\//g, `"${relative(dirname(path), '/assets')}/`)
      },
    },
  ],
  build: {
    outDir: r('dist'),
    emptyOutDir: true,
    sourcemap: isDev ? 'inline' : false,
    // https://developer.chrome.com/docs/webstore/program_policies/#:~:text=Code%20Readability%20Requirements
    terserOptions: {
      mangle: false,
    },
    rollupOptions: {
      input: {
        background: r('src/background.js'),
        options: r('src/options/index.html'),
        popup: r('src/popup/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js'
      }
    },
  },
}));