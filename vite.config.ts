import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 5173,
    // Прокси не нужен, так как мы используем прямое подключение к API
    // через VITE_API_BASE_URL в src/core/api.ts
  },
  plugins: [react()],
});
