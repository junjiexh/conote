import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // only for dev
    host: "0.0.0.0", // Listen on all interfaces for Docker
    port: 3000,
    proxy: {
      "/api": {
        target: "http://backend:8080", // Use docker service name
        changeOrigin: true,
      },
    },
    watch: {
      usePolling: true, // Enable polling for file changes in Docker
    },
  },
});
