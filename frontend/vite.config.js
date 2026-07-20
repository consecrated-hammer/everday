import process from "node:process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const ParseAllowedHosts = (value) =>
  value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : ["localhost", "127.0.0.1"];

export default defineConfig({
  plugins: [react()],
  build: {
    // BlockNote is an intentionally lazy, Notes-only rich-editor dependency.
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5183,
    allowedHosts: ParseAllowedHosts(process.env.VITE_ALLOWED_HOSTS)
  }
});
