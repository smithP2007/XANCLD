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
    port: 3002,
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
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "video-vendor": ["hls.js"],
        },
      },
    },
  },
  worker: {
    format: "es",
  },
});
