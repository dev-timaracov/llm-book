import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// base: './' — чтобы собранный сайт открывался с любого пути (GitHub Pages, локальный файл-сервер)
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      // общие компоненты платформы: import { M, Code } from '@shared/ui.jsx'
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
});
