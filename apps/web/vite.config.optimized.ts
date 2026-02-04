import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc' // Use SWC for faster builds
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Bundle size visualization (run with --analyze flag)
    visualizer({
      open: false,
      filename: 'dist/bundle-analysis.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Target modern browsers for smaller bundle
    target: 'es2020',
    // Enable minification
    minify: 'esbuild',
    // Source maps for production debugging
    sourcemap: false,
    // Rollup optimizations
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Core React libraries
          'react-vendor': [
            'react',
            'react-dom',
            'react-router-dom',
          ],
          // Data fetching and state management
          'query-vendor': [
            '@tanstack/react-query',
            'axios',
            'zustand',
          ],
          // Charting library (heavy)
          'chart-vendor': [
            'recharts',
          ],
          // Real-time communication
          'socket-vendor': [
            'socket.io-client',
          ],
          // UI and animations
          'ui-vendor': [
            'framer-motion',
            'lucide-react',
          ],
          // Date utilities
          'date-vendor': [
            'date-fns',
          ],
        },
        // Optimize chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit (after splitting)
    chunkSizeWarningLimit: 1000,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
    ],
  },
  // Server configuration for development
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  // Production preview server
  preview: {
    port: 4173,
    strictPort: true,
  },
})
