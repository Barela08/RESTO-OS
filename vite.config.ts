import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  // @ts-expect-error vitest config
  test: {
    setupFiles: ['./tests/setup.ts'],
  },
})
