/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * En desarrollo (`npm run dev`) sirve /api/* con las MISMAS funciones que usa Netlify,
 * leyendo AUTH_USER y AUTH_PASSWORD de .env.local. En producción esto no existe: lo hace Netlify.
 */
function netlifyFunctionsDev(): Plugin {
  const routes: Record<string, string> = { '/api/login': 'login', '/api/logout': 'logout', '/api/session': 'session' };
  return {
    name: 'netlify-functions-dev',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), 'AUTH_');
      Object.assign(process.env, env);
      server.middlewares.use(async (req, res, next) => {
        const fn = routes[(req.url ?? '').split('?')[0]];
        if (!fn) return next();
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          });
          const mod = await server.ssrLoadModule(`/netlify/functions/${fn}.ts`);
          const response: Response = await mod.default(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => k !== 'set-cookie' && res.setHeader(k, v));
          const cookies = response.headers.getSetCookie();
          if (cookies.length) res.setHeader('set-cookie', cookies);
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), netlifyFunctionsDev()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          konva: ['konva', 'react-konva'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
