import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Собирается под путь /app/ — отдаётся тем же backend-сервером рядом с админкой (/).
export default defineConfig({
  base: "/app/",
  plugins: [react()],
});
