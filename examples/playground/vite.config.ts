import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Served under /demo/ on the docs site; '/' locally.
  base: process.env.DEMO_BASE ?? '/',
  server: { port: 5180 },
  build: { outDir: 'dist', emptyOutDir: true },
})
