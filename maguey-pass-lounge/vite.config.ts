import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { securityHeaders } from "./src/lib/security-headers";

// https://vitejs.dev/config/
const basePath = process.env.VITE_APP_BASE_PATH || "/";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? basePath : "/",
  server: {
    host: "::",
    port: 3016,
    headers: securityHeaders,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    envFile: false,
    exclude: ["playwright/**", "node_modules/**"],
  },
}));
