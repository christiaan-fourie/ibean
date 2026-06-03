export default function manifest() {
  return {
    name: "iBEAN",
    short_name: "iBEAN",
    description: "iBEAN tablet dashboard and point of sale",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#0f1115",
    theme_color: "#0f1115",
    id: "/dashboard",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
