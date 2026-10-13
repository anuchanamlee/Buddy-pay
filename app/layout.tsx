// นำเข้าประเภท Metadata จาก Next.js เพื่อระบุข้อมูลเมตาของหน้าเว็บ
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
// นำเข้าไฟล์สไตล์ globals.css สำหรับกำหนดสไตล์ทั่วโลก
import "./globals.css";
// นำเข้าคอมโพเนนต์ Providers สำหรับครอบคลุม Context ต่างๆ (เช่น authentication, theme, ฯลฯ)
import Providers from './providers';
import { FirebaseProvider } from './components/providers/FirebaseWrapper';
import { AuthProvider } from './context/AuthContext';
import { AuthModalProvider } from './context/AuthModalContext';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import ErrorMonitoringProvider from './components/providers/ErrorMonitoringProvider';

// ฟอนต์เดียวทั้งแอป: มีทั้งไทยและละติน ตัวเลขอ่านง่าย (เดิมโหลด Inter + Open Sans + Prompt)
const plexThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-thai',
  fallback: ['system-ui', 'sans-serif'],
});

// กำหนด metadata ของแอปพลิเคชัน
export const metadata: Metadata = {
  title: 'BuddyPay - แชร์บิลกับเพื่อนง่ายๆ',
  description: 'แอปสำหรับแชร์บิลร้านอาหารและค่าใช้จ่ายอื่นๆ กับเพื่อนของคุณ แชร์อย่างเป็นธรรมไม่มีใครได้เปรียบเสียเปรียบ',
  authors: [{ name: 'BuddyPay Team' }],
  keywords: ['บิล', 'แชร์บิล', 'แบ่งบิล', 'อาหาร', 'คำนวณบิล'],
  icons: {
    icon: '/icon-192x192.png',
    apple: '/icon-192x192.png',
  },
  // iPhone: เพิ่มลงหน้าจอโฮมแล้วเปิดเต็มจอเหมือนแอป
  appleWebApp: {
    capable: true,
    title: 'BuddyPay',
    statusBarStyle: 'default',
  },
  // เพิ่มสำหรับ PWA
  manifest: '/manifest.json',
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
  themeColor: '#146F68',
  colorScheme: 'light',
  // Android Chrome: คีย์บอร์ดเปิดแล้วหดหน้าเว็บตาม ช่องพิมพ์และแถบล่างจอจึงไม่ถูกคีย์บอร์ดบัง
  interactiveWidget: 'resizes-content',
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
    <html lang="th" className={plexThai.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://firebaseapp.com" crossOrigin="anonymous" />
        {/* เพิ่ม favicon ขนาดต่างๆ */}
        <link rel="icon" type="image/png" href="/icon-192x192.png" sizes="192x192" />
        <link rel="icon" type="image/png" href="/icon-512x512.png" sizes="512x512" />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        <ErrorBoundary componentName="RootLayout" level="critical">
          <Providers>
            <FirebaseProvider>
              <AuthProvider>
                <ErrorMonitoringProvider>
                  <AuthModalProvider>
                    <AppShell>{children}</AppShell>
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
