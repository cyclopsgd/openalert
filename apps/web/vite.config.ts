import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // Listen on all network interfaces (0.0.0.0)
    port: 5175,
  },
  build: {
    // Reduce chunk size limit to ensure smaller bundles
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunk - most frequently used libraries
          'vendor-core': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          // Query management
          'vendor-query': [
            '@tanstack/react-query',
          ],
          // UI & Animation libraries
          'vendor-ui': [
            'framer-motion',
            'lucide-react',
          ],
          // Charts - lazy loaded but grouped together
          'vendor-charts': [
            'recharts',
          ],
          // Network & realtime
          'vendor-network': [
            'axios',
            'socket.io-client',
          ],
          // Utilities
          'vendor-utils': [
            'zustand',
            'date-fns',
            'clsx',
            'tailwind-merge',
            'class-variance-authority',
          ],
        },
      },
    },
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
    // Source maps for debugging (can be disabled for smaller builds)
    sourcemap: false,
  },
})
