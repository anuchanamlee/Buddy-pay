// นำเข้าประเภท Metadata จาก Next.js เพื่อระบุข้อมูลเมตาของหน้าเว็บ
import type { Metadata, Viewport } from "next";
// นำเข้า Font "Inter" จาก Google Fonts
import { Inter } from "next/font/google";
// นำเข้าไฟล์สไตล์ globals.css สำหรับกำหนดสไตล์ทั่วโลก
import "./globals.css";
// นำเข้าคอมโพเนนต์ Providers สำหรับครอบคลุม Context ต่างๆ (เช่น authentication, theme, ฯลฯ)
import Providers from './providers';
import { FirebaseProvider } from './components/providers/FirebaseWrapper';
import { AuthProvider } from './context/AuthContext';
import { AuthModalProvider } from './context/AuthModalContext';
import AppShell from './components/AppShell';
import ChatbotPopup from './components/ChatbotPopup';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorMonitoringProvider from './components/providers/ErrorMonitoringProvider';
import { Open_Sans, Prompt } from 'next/font/google';

// กำหนดการใช้งานฟอนต์ Inter พร้อมกำหนด subset ของตัวอักษรที่ใช้ (latin)
const inter = Inter({ 
  subsets: ["latin", "latin-ext"], // เพิ่ม latin-ext
  display: 'swap', // เพิ่ม display swap เพื่อให้ข้อความแสดงผลด้วยฟอนต์สำรองก่อน
  preload: true,   // preload ฟอนต์
  fallback: ['system-ui', 'arial', 'sans-serif'] // เพิ่ม fallback fonts
});

// Preload และกำหนดขนาด subset เพื่อลดเวลาโหลดฟอนต์
const openSans = Open_Sans({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif'],
  weight: ['400', '500', '600', '700'], // โหลดเฉพาะ weights ที่ใช้
  variable: '--font-open-sans'
});

// สำหรับฟอนต์ภาษาไทย
const prompt = Prompt({
  weight: ['400', '500'],
  subsets: ['thai'],
  display: 'swap',
  preload: true,
  variable: '--font-prompt'
});

// กำหนด metadata ของแอปพลิเคชัน
export const metadata: Metadata = {
  title: 'BuddyPay - แชร์บิลกับเพื่อนง่ายๆ',
  description: 'แอปสำหรับแชร์บิลร้านอาหารและค่าใช้จ่ายอื่นๆ กับเพื่อนของคุณ แชร์อย่างเป็นธรรมไม่มีใครได้เปรียบเสียเปรียบ',
  authors: [{ name: 'BuddyPay Team' }],
  keywords: ['บิล', 'แชร์บิล', 'แบ่งบิล', 'อาหาร', 'คำนวณบิล'],
  icons: {
    icon: '/icon-192x192.png',
  },
  // เพิ่มสำหรับ PWA
  manifest: '/manifest.json',
  // ลดขนาด bundle
  alternates: {
    canonical: 'https://buddypay.app',
  },
  formatDetection: {
    telephone: true,
    address: false,
    email: true,
  },
};

// Viewport optimization
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  userScalable: true, // ให้ผู้ใช้ซูมได้เพื่อความเป็น accessibility
  themeColor: '#4f46e5',
  colorScheme: 'light',
};

// revalidate ทุก 24 ชม.
export const revalidate = 86400;

// คอมโพเนนต์ RootLayout เป็นส่วนหลักของแอปที่ครอบคลุมทุกหน้า
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={`${inter.className} ${openSans.variable} ${prompt.variable}`} suppressHydrationWarning>
      <head>
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://firebaseapp.com"
          crossOrigin="anonymous"
        />
        {/* ปรับปรุง Content Security Policy */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com;"
        />
        {/* ใช้ style tag แบบ inline ดีกว่าสำหรับ critical CSS */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Critical CSS for LCP */
          .bg-gradient-to-r.from-primary.to-secondary {
            background-image: linear-gradient(to right, #3b82f6, #4f46e5);
          }
          h1.text-4xl.md\\:text-5xl.font-bold.leading-tight {
            font-size: 2.25rem;
            line-height: 2.5rem;
            font-weight: 700;
            margin-top: 0;
            color: white;
          }
          @media (min-width: 768px) {
            h1.text-4xl.md\\:text-5xl.font-bold.leading-tight {
              font-size: 3rem;
              line-height: 1;
            }
          }
        `}} />
        {/* Preload fonts และ critical assets */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Add DNS prefetching for external resources */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        
        {/* Set viewport */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* เพิ่ม favicon ขนาดต่างๆ */}
        <link rel="icon" type="image/png" href="/icon-192x192.png" sizes="192x192" />
        <link rel="icon" type="image/png" href="/icon-512x512.png" sizes="512x512" />
      </head>
      <body className="bg-gray-50">
        <ErrorBoundary componentName="RootLayout" level="critical">
          <Providers>
            <FirebaseProvider>
              <AuthProvider>
                <ErrorMonitoringProvider>
                  <AuthModalProvider>
                    <AppShell>{children}</AppShell>
                    {/* อยู่ภายใต้ AuthProvider เพื่อใช้ ID token ของผู้ใช้เรียก /api/chat */}
                    <ChatbotPopup
                      position="bottom-right"
                      botName="BuddyPay Helper"
                      primaryColor="bg-blue-600"
                    />
                  </AuthModalProvider>
                </ErrorMonitoringProvider>
              </AuthProvider>
            </FirebaseProvider>
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
