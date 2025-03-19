import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3001,
      strictPort: true,
      proxy: isProd ? undefined : {
        '/api': {
          target: 'http://localhost:3030',
          changeOrigin: true,
        },
      },
      // Enable history API fallback to ensure client-side routing works
      historyApiFallback: true,
    },
    // Ensure React Router works properly
    base: '/',
  };
});
