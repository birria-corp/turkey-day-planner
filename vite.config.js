import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this app at /turkey-day-planner/
export default defineConfig({
  base: '/turkey-day-planner/',
  plugins: [react()],
  test: { environment: 'node' },
});
