import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { writeFileSync, readFileSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'spa-fallback',
      closeBundle() {
        // Copy index.html as 200.html (Render/Surge SPA fallback)
        try {
          const html = readFileSync('dist/index.html', 'utf-8');
          writeFileSync('dist/200.html', html);
        } catch {}
      }
    }
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // Для TestFlight/production не публикуем sourcemaps по умолчанию.
    // Включать только в закрытом CI-процессе, где .map загружаются в Sentry
    // и не остаются публично доступными рядом с JS-бандлом.
    sourcemap: process.env.BUILD_SOURCEMAPS === 'true',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Держим тяжелые SDK в отдельных чанках: старт приложения быстрее,
        // а редкие экраны (карта, звонки, аналитика) не утяжеляют main.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('mapbox-gl')) return 'vendor-map';
          if (id.includes('@100mslive') || id.includes('peerjs')) return 'vendor-calls';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@sentry')) return 'vendor-sentry';
          if (id.includes('chess.js')) return 'vendor-games';
          return 'vendor';
        },
      },
    },
  },
});
