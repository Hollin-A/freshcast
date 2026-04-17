import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Freshcast",
    short_name: "Freshcast",
    description:
      "AI-powered sales tracking and demand prediction for small businesses",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f9f6f2",
    theme_color: "#2a9d8f",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
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
