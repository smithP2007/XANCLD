import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@web": resolve(__dirname, "src/web"),
      "@shared": resolve(__dirname, "src/shared"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    // Allow the platform preview proxy (and any other host) to access Vite.
    // Vite 6+ blocks unknown Host headers by default for DNS-rebinding protection;
    // the platform's Caddy proxy uses internal hostnames like
    // ws-bf-cf-<id>.cn-hongkong-vpc.fcapp.run which we need to explicitly allow.
    allowedHosts: true,
    // During dev, proxy /api/* to the wrangler dev server (port 3003)
    proxy: {
      "/api": {
        target: "http://localhost:3003",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "assets/index-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        // B8: Vite 8 (rolldown) no longer accepts the object form of
        // manualChunks — use the function form. Same grouping as before:
        // react family → react-vendor, hls.js → video-vendor.
        manualChunks(id) {
          if (id.includes("node_modules/hls.js")) return "video-vendor";
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/scheduler")
          ) {
            return "react-vendor";
          }
          return undefined;
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
