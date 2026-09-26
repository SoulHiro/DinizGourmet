import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.freepik.com",
      },
    ],
  },
  allowedDevOrigins: ["192.168.1.143", "192.168.1.227"],
};

export default nextConfig;
