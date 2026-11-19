import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — чтобы собранный учебник открывался с любого пути (GitHub Pages, локальный файл-сервер)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { fs: { allow: ['..'] } },
});
