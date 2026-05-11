import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react({
        // Use classic JSX transform — avoids automatic runtime CSP issues
        jsxRuntime: 'automatic',
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@api': path.resolve(__dirname, './src/api'),
        '@store': path.resolve(__dirname, './src/store'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@types': path.resolve(__dirname, './src/types'),
        '@utils': path.resolve(__dirname, './src/utils'),
      },
    },

    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env['VITE_API_BASE_URL'] ?? 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    build: {
      target: 'es2022',
      outDir: 'dist',
      sourcemap: mode !== 'production',
      // CSP-compatible: no inline scripts
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          // Deterministic chunk names (function form required by Rolldown / Vite 8)
          manualChunks(id) {
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react';
            if (id.includes('node_modules/react-router')) return 'router';
            if (id.includes('node_modules/@tanstack/react-query')) return 'query';
            if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform') || id.includes('node_modules/zod')) return 'forms';
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge')) return 'ui';
          },
          // Asset naming — no content hash collisions
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
      // Warn if chunk > 500 kB
      chunkSizeWarningLimit: 500,
    },

    preview: {
      port: 4173,
      strictPort: true,
      headers: {
        // Preview-mode CSP headers (production CSP set in nginx)
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
      },
    },

    // Env variable prefix exposed to the client
    envPrefix: 'VITE_',

    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
    },
  };
});
