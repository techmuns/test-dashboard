import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Embedded Munshot dashboard: runs inside a Munshot host iframe.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
