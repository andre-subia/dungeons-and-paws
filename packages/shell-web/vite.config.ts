import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ["da01-2800-200-f430-891-ed52-a991-ae3c-bba.ngrok-free.app"],
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
