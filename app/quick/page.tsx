import type { Metadata } from 'next';
import { QuickLauncher } from './QuickLauncher';

// หน้านี้มี manifest ของตัวเอง กด "เพิ่มลงหน้าจอโฮม" จากหน้านี้จะได้ไอคอน "หารด่วน" แยกจากไอคอน BuddyPay
export const metadata: Metadata = {
  title: 'หารด่วน - BuddyPay',
  manifest: '/manifest-quick.json',
  appleWebApp: { capable: true, title: 'หารด่วน', statusBarStyle: 'default' },
};

export default function QuickPage() {
  return <QuickLauncher />;
}
