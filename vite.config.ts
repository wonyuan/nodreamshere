import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Serves the files in /api as local endpoints during development, using the same
// Web Request -> Response handlers that Vercel runs in production.
function apiRoutes(): Plugin {
  return {
    name: "api-routes",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        const match = url.pathname.match(/^\/api\/([a-z-]+)$/);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`);
          const handler = mod[req.method ?? "GET"];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const request = new Request(url, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(String(err));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "server error" }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make server-only secrets in .env visible to the /api handlers in dev.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    plugins: [react(), apiRoutes()],
    // Spotify no longer accepts "localhost" redirect URIs, only 127.0.0.1.
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
  };
});
