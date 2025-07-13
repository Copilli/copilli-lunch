import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/copilli-launch/' // ← Reemplaza esto con el nombre real del repo
});
