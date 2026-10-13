import type { Metadata } from 'next';
import { InstallGuide } from './InstallGuide';

export const metadata: Metadata = {
  title: 'ใช้บนมือถือ - BuddyPay',
  description: 'ติดตั้ง BuddyPay ลงหน้าจอโฮม เปิดตัวเลขยอดค้างบนไอคอน และแจ้งเตือนทวงเงิน',
};

export default function InstallPage() {
  return <InstallGuide />;
}
