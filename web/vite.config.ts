import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    // 'hidden' emits sourcemaps but does NOT include the //# sourceMappingURL
    // pragma in the bundled JS — so devtools won't auto-fetch them, the
    // public-facing JS reveals nothing, and we can still upload the maps
    // to Sentry out-of-band for symbolicated stack traces.
    sourcemap: 'hidden',
  },
});
