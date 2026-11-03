import type { MetadataRoute } from "next";
import { THEME_COLOR } from "@/components/shared/theme-color";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Freshcast",
    short_name: "Freshcast",
    description:
      "AI-powered sales tracking and demand prediction for small businesses",
    start_url: "/dashboard",
    display: "standalone",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
