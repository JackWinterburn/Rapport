import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const API = process.env.API_URL ?? "http://localhost:8787";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      devOptions: { enabled: false },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
      },
      includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Rapport",
        short_name: "Rapport",
        description: "Remember what matters to the people in your life.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        categories: ["lifestyle", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Log conversation", url: "/capture", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Upcoming", url: "/upcoming", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": API,
      "/auth": API,
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": API,
      "/auth": API,
    },
  },
});
