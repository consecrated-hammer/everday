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
  server: {
    host: true,
    port: 5183,
    allowedHosts: ParseAllowedHosts(process.env.VITE_ALLOWED_HOSTS)
  }
});
