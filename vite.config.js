import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api-proxy': {
        target: 'https://api.openligadb.de/getmatchdata/wm26/2026',
        changeOrigin: true,
        rewrite: (path) => ''
      }
    }
  }
});
