import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dashboard is embedded as an iframe inside the Munshot host.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
