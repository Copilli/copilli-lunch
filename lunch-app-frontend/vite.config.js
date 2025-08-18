import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/copilli-lunch/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1024,
  },
});