import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// PORT lets the harness hand this server a free port instead of colliding
// with whatever else is already on the default one.
const port = Number(process.env.PORT) || 5174;

export default defineConfig({
  plugins: [react(), cloudflare()],
  server: { port },
});
