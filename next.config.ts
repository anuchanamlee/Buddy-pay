import type { NextConfig } from "next";
import TerserPlugin from "terser-webpack-plugin";

// Next.js โหลด config เพียงไฟล์เดียว (ลำดับ: next.config.js → .mjs → .ts)
// โปรเจกต์นี้ใช้ไฟล์นี้ไฟล์เดียว ห้ามเพิ่ม next.config.js/.mjs เพราะจะทำให้ไฟล์นี้ถูกละเลย

// ค่า NEXT_PUBLIC_* ถูกฝังลงใน bundle ตอน build ถ้าไม่ครบ build จะผ่านได้
// แต่แอปจะใช้งาน Firebase ใน browser ไม่ได้ จึงเตือนให้เห็นชัดเจน
// (ต้องตรงกับ REQUIRED_CONFIG ใน app/lib/firebase.ts)
const REQUIRED_PUBLIC_ENV = ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"];
const missingPublicEnv = REQUIRED_PUBLIC_ENV.filter((name) => !process.env[name]);
if (missingPublicEnv.length > 0) {
  console.warn(
    `\n⚠️  Missing Firebase config: ${missingPublicEnv.join(", ")}\n` +
      "   This build is NOT deployable: the app will fail in the browser until these are set.\n"
  );
}

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    domains: ['firebasestorage.googleapis.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
        pathname: '**',
      },
    ],
  },
  compress: true,
  poweredByHeader: false,
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com; img-src 'self' data: https://firebasestorage.googleapis.com https://*.googleusercontent.com; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com;",
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ]
      }
    ];
  },
  experimental: {
    optimizeCss: true,
    optimizeServerReact: true,
    scrollRestoration: true,
    optimizePackageImports: ['lucide-react'],
  },
  // ย้ายมาจาก next.config.js เดิม: ลบ console.* ออกจาก client bundle ตอน production build
  // (ไม่กระทบ server เพื่อให้ log ของ API routes ยังทำงาน)
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.minimizer.push(
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
            },
          },
        })
      );
    }
    return config;
  },
};

export default nextConfig;
