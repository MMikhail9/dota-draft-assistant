import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: /<repo>/
export default defineConfig({
  plugins: [react()],
  base: '/dota-draft-assistant/',
})
