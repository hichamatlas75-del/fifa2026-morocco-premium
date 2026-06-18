import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api-proxy': {
        target: 'https://api.openligadb.de/getmatchdata/wm26/2026',
        changeOrigin: true,
        rewrite: (path) => ''
      },
      '/api-worldcup': {
        target: 'https://worldcup26.ir/get/games',
        changeOrigin: true,
        rewrite: (path) => ''
      },
      '/api-footballdata': {
        target: 'https://api.football-data.org/v4/competitions/WC/matches',
        changeOrigin: true,
        rewrite: (path) => ''
      }
    }
  }
});
