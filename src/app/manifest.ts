import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Property Room",
    short_name: "Property Room",
    description:
      "Professional property marketing and visual media for estate agents.",
    start_url: "/",
    display: "browser",
    background_color: "#f5f0eb",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
