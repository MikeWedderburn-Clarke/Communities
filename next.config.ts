import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "better-sqlite3",
    "leaflet",
    "leaflet.markercluster",
    "react-leaflet",
    "react-leaflet-cluster",
    "@react-leaflet/core",
  ],
};

export default nextConfig;
