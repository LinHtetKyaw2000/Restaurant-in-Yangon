import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg", "icon-192.svg", "icon-512.svg"],
            manifest: {
                name: "Restaurant in Yangon",
                short_name: "Yangon Restaurants",
                description: "Warmly Welcome...",
                theme_color: "#0284c7",
                background_color: "#e0f2fe",
                display: "standalone",
                start_url: "/",
                icons: [
                    {
                        src: "icon-192.svg",
                        sizes: "192x192",
                        type: "image/svg+xml",
                        purpose: "any maskable"
                    },
                    {
                        src: "icon-512.svg",
                        sizes: "512x512",
                        type: "image/svg+xml",
                        purpose: "any maskable"
                    }
                ]
            },
            workbox: {
                navigateFallbackDenylist: [/^\/api\//],
                runtimeCaching: [
                    {
                        urlPattern: function (_a) {
                            var request = _a.request;
                            return request.destination === "image";
                        },
                        handler: "CacheFirst",
                        options: {
                            cacheName: "restaurant-images",
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 * 30
                            }
                        }
                    }
                ]
            }
        })
    ]
});
