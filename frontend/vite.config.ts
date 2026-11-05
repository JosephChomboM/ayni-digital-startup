import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  // Render sets RENDER_EXTERNAL_URL for its services; custom domains can override it.
  const siteUrl = env.VITE_SITE_URL || process.env.RENDER_EXTERNAL_URL;
  return {
    plugins: [react(), {
      name: "ayni-social-url",
      transformIndexHtml(html) {
        if (!siteUrl) return html;
        const origin = new URL(siteUrl);
        if (!["https:", "http:"].includes(origin.protocol)) throw new Error("VITE_SITE_URL debe ser una URL web.");
        const image = new URL("/social-preview.png", origin).href.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
        return html.replaceAll('content="/social-preview.png"', `content="${image}"`);
      },
    }],
  };
});
