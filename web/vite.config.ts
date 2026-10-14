import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import readingApi from "./server/readingApi.ts";

export default defineConfig(({ mode }) => {
  // Đọc GEMINI_API_KEY (và GEMINI_MODEL nếu có) từ .env.local (prefix "" để biến không bị lộ ra client)
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss(), readingApi(env.GEMINI_API_KEY, env.GEMINI_MODEL || undefined)],
  };
});
