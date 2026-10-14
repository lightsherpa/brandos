import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  define: { __AGENCY_OFFICE__: JSON.stringify(["1", "true"].includes(loadEnv(mode, process.cwd(), "").AGENCY_OFFICE)) },
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: { app: "index.html", officePreview: "office-preview.html" },
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react")) return "react-vendor";
          if (id.includes("node_modules/@supabase")) return "supabase-vendor";
        },
      },
    },
  },
}));
