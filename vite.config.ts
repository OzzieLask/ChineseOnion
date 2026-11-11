import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works under any GitHub Pages sub-path
// Fixed dev port: browser storage (your cards) is tied to the address, so it must not change.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5179, strictPort: true },
});
