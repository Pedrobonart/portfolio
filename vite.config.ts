import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
    // Force a single copy of these packages to prevent "Invalid hook call" errors
    dedupe: ['react', 'react-dom', 'react-router'],
  },
  optimizeDeps: {
    // Pre-bundle these so dynamic imports in Globe3D resolve reliably
    include: ['three', 'topojson-client'],
    // Prevent Vite from trying to scan/bundle unused legacy packages
    exclude: ['react-leaflet', 'leaflet'],
  },
  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})