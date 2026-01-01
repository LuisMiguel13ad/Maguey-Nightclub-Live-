import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { securityHeaders } from "./src/lib/security-headers";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 3015,
    https: true,
    headers: securityHeaders,
  },
  plugins: [react(), basicSsl(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
