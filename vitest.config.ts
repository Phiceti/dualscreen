import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['packages/*/test/**/*.test.ts?(x)', 'examples/*/test/**/*.test.tsx'],
    environment: 'node',
    environmentMatchGlobs: [
      ['packages/react/test/**', 'happy-dom'],
      ['packages/screens/test/**', 'happy-dom'],
      ['examples/**', 'happy-dom'],
    ],
  },
})
