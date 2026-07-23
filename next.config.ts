import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // User-uploaded photos are served from Supabase storage in production;
  // seed/demo photos come from the public/ folder.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
