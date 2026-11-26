import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "getitdone — tasks, focus and goals",
    short_name: "getitdone",
    description: "A calm place for all your work.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfcfa",
    theme_color: "#1d6b4f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
