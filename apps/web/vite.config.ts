import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@lendora/financial-engine': path.resolve(__dirname, '../../packages/financial-engine/src'),
      '@lendora/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
      '@lendora/validation': path.resolve(__dirname, '../../packages/validation/src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
