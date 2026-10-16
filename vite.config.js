import { defineConfig } from "vite";
export default defineConfig(({ mode }) => ({
  base: mode === "sandbox" ? "/actionproof/" : "/",
  define: { __SANDBOX__: JSON.stringify(mode === "sandbox") },
  build: {
    outDir: mode === "sandbox" ? "sandbox-dist" : "dist",
    emptyOutDir: true,
  },
  server: { proxy: { "/api": "http://127.0.0.1:4310" } },
}));
