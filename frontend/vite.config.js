import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://127.0.0.1:5000';

  return defineConfig({
    plugins: [react()],
    server: {
      host: true,
      strictPort: true,
      port: 4173,
      open: true,
      watch: {
        usePolling: true,
        interval: 100,
      },
      hmr: {
        protocol: 'ws',
      },
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            proxy.on('proxyRes', (proxyRes, req, res) => {
              // Add no-cache headers for API responses
              proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
              proxyRes.headers['Pragma'] = 'no-cache';
              proxyRes.headers['Expires'] = '0';
            });
          }
        },
      },
      middleware: [
        (req, res, next) => {
          // Add no-cache headers for admin routes
          if (req.url.includes('/admin')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          }
          next();
        }
      ]
    },
  });
};
