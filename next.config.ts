import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "leaflet",
    "leaflet.markercluster",
    "react-leaflet",
    "react-leaflet-cluster",
    "@react-leaflet/core",
  ],
};

export default nextConfig;
