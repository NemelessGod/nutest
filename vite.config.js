import { defineConfig } from "vite";
export default defineConfig({
  root: "client",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { abyss: "client/index.html", serpents: "client/serpents.html" },
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:3001",
      "/socket.io": { target: "http://127.0.0.1:3001", ws: true },
    },
  },
});
