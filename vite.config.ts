import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: '/jeju-haenyeo/',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'fix-github-pages-asset-paths',
        transformIndexHtml(html) {
          return html.replace(/\/src\/assets\//g, '/jeju-haenyeo/src/assets/');
        },
        transform(code, id) {
          if (id.endsWith('.tsx') || id.endsWith('.ts') || id.endsWith('.jsx') || id.endsWith('.js')) {
            return code.replace(/(['"`])\/src\/assets\//g, '$1/jeju-haenyeo/src/assets/');
          }
        },
      },
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
