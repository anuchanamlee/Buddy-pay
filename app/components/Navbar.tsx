'use client';

import { formatTHB } from '@/app/lib/format';
import { billShares } from '@/app/lib/billShares';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFirebase } from '../components/providers/FirebaseWrapper';
import { Button } from './ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/Avatar';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/DropdownMenu';
import { useAuthModal } from '../context/AuthModalContext';
import { useAuth } from '../context/AuthContext';
import { Menu, Bell, Clock, CheckCircle2 } from 'lucide-react';
import { collection, query, limit, onSnapshot, QueryDocumentSnapshot, DocumentData, where } from 'firebase/firestore';

// สร้าง Nullable version ของ useFirebase - ปรับปรุงเพื่อลด re-render
function useSafeFirebase() {
  const [isMounted, setIsMounted] = useState(false);
  const firebase = useFirebase();
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // ใช้ useMemo เพื่อ cache ค่า firebase
  const safeFirebase = useMemo(() => {
    if (!isMounted) {
      return { app: null, db: null, auth: null };
    }
    return firebase;
  }, [isMounted, firebase]);
  
  return safeFirebase;
}

// Interface สำหรับบิลที่ค้างชำระ
interface PendingBill {
  id: string;
  title: string;
  totalAmount: number;
  createdAt: Date;
  participantName?: string;
  amountOwed?: number;
}

// Custom Hook สำหรับดึงข้อมูลบิลที่ค้างชำระแบบ real-time - ปรับปรุงเพื่อลด re-render
function usePendingBills() {
  const [pendingBills, setPendingBills] = useState<PendingBill[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const firebase = useSafeFirebase();

  // ใช้ useCallback เพื่อ cache ฟังก์ชัน
  const processBills = useCallback((snapshot: any) => {
    try {
      const bills: PendingBill[] = [];
      let count = 0;

      snapshot.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        
        // แสดงเฉพาะบิลที่ผู้ใช้เป็นเจ้าของ
        if (data.userId !== user?.uid) {
          return;
        }
        
        // ตรวจสอบว่ามีคนค้างชำระหรือไม่
        const pendingParticipants = data.participants?.filter((p: any) => 
          p.status === 'pending'
        );
        
        if (pendingParticipants && pendingParticipants.length > 0) {
          // คำนวณยอดค้างชำระรวมจากยอดของแต่ละคน (เดิมอ่าน p.amount ซึ่งไม่มีอยู่จริง ยอดจึงเป็น 0 เสมอ)
          const shares = billShares(data);
          const totalPendingAmount = pendingParticipants.reduce((sum: number, p: any) =>
            sum + (shares.find((r) => r.participant?.id === p.id)?.amount || 0), 0
          );
          
          // สร้างรายชื่อคนที่ค้างชำระ
          const pendingNames = pendingParticipants.map((p: any) => p.name).join(', ');
          
          bills.push({
            id: doc.id,
            title: data.title || data.name || 'ไม่มีชื่อบิล',
            totalAmount: data.totalAmount || 0,
            createdAt: data.createdAt?.toDate() || new Date(),
            participantName: pendingNames,
            amountOwed: totalPendingAmount
          });
          count++;
        }
      });

      // เรียงลำดับตามวันที่สร้าง (ใหม่ไปเก่า)
      const sortedBills = bills.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      
      setPendingBills(sortedBills);
      setPendingCount(count);
      setLoading(false);
    } catch (error) {
      console.error('Error processing pending bills:', error);
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!isAuthenticated || !user || !firebase.db) {
      return;
    }

    setLoading(true);

    // ฟังแบบ real-time เฉพาะบิลที่ยังเก็บเงินไม่ครบ (status = pending) เดิมฟังบิลล่าสุด 100 ใบทุกครั้งที่เปิดแอป
    // ทำให้เปลืองโควตาอ่านของ Firestore ตามจำนวนบิลทั้งหมด ไม่ใช่จำนวนบิลที่ค้าง
    // ใช้ตัวกรองแบบเท่ากับ 2 ฟิลด์ ไม่ต้องสร้าง composite index เพิ่ม
    const billsQuery = query(
      collection(firebase.db, 'bills'),
      where('userId', '==', user.uid),
      where('status', '==', 'pending'),
      limit(50)
    );

    const unsubscribe = onSnapshot(billsQuery, processBills, (error: Error) => {
      console.error('Error in pending bills snapshot:', error);
      setLoading(false);
    });

    // Cleanup function
    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, user, firebase.db, processBills]);

  return { pendingBills, pendingCount, loading };
}

export default function Navbar() {
  const pathname = usePathname();
  const { openLoginModal, openSignupModal } = useAuthModal();
  const { user, isAuthenticated, logout, userRole, loading: authLoading } = useAuth();
  const firebase = useSafeFirebase();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  
  const { pendingBills, pendingCount, loading } = usePendingBills();
  
  // ถ้า Firebase ยังไม่พร้อม ให้แสดง skeleton หรือข้อความรอโหลด
  if (!firebase.app || !firebase.db || !firebase.auth) {
    return (
      <header className="fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-50 animate-pulse">
        <div className="container mx-auto h-full flex items-center justify-between">
          <div className="h-6 w-32 bg-muted rounded"></div>
          <div className="h-8 w-40 bg-muted rounded"></div>
        </div>
      </header>
    );
  }
  
  // เมนูหลักของ Navbar
  const mainNavItems = [
    { href: '/share-bill', label: 'แชร์บิล' },
    { href: '/bill-history', label: 'ประวัติบิล' },
    { href: '/statistics', label: 'สถิติ' },
  ];

  // ฟังก์ชันสำหรับจัดรูปแบบวันที่
  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'เมื่อสักครู่';
    if (diffInHours < 24) return `${diffInHours} ชั่วโมงที่แล้ว`;
    if (diffInHours < 48) return 'เมื่อวาน';
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} วันที่แล้ว`;
    
    return date.toLocaleDateString('th-TH', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur border-b border-border z-50">
      <div className="container mx-auto h-full px-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" aria-label="BuddyPay หน้าแรก" className="rounded-md">
          <div className="flex items-center gap-2">
            {/* โลโก้: สลิปใบเสร็จมีรอยปรุ */}
            <svg width="28" height="32" viewBox="0 0 28 32" aria-hidden="true">
              <path d="M4 0h20a4 4 0 0 1 4 4v24l-3.5 4-3.5-4-3.5 4-3.5-4-3.5 4-3.5-4L0 32V4a4 4 0 0 1 4-4z" fill="var(--primary)" />
              <text x="14" y="20" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff" fontFamily="var(--font-plex-thai), sans-serif">฿</text>
            </svg>
            <span className="font-bold text-lg text-foreground">BuddyPay</span>
          </div>
        </Link>

        {/* เมนูหลักสำหรับเดสก์ท็อป */}
        <nav className="hidden md:flex items-center space-x-6">
          {mainNavItems.map((item) => (
            <Link 
              key={item.href} 
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                pathname === item.href 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-primary'
              }`}
            >
              {item.label}
            </Link>
          ))}
          {/* แสดงปุ่มนำทางไปยังหน้า Admin เฉพาะเมื่อผู้ใช้งานมีบทบาทเป็น admin */}
          {userRole === 'admin' && (
            <Link href="/admin" className={`text-sm font-medium transition-colors ${pathname === '/admin' ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
              หน้า Admin
            </Link>
          )}
        </nav>

        {/* ส่วนขวาสุดของ Navbar */}
        <div className="flex items-center space-x-2">
          {/* ปุ่มเมนูสำหรับโทรศัพท์มือถือ */}
          <button 
            className="md:hidden p-2 rounded-md hover:bg-gray-100" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="เปิด/ปิดเมนู"
          >
            <Menu size={24} />
          </button>
          
          {/* ปุ่มแจ้งเตือนยอดค้างชำระ (แสดงเฉพาะเมื่อล็อกอิน) */}
          {isAuthenticated && (
            <DropdownMenu open={notificationOpen} onOpenChange={setNotificationOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative p-2 hover:bg-gray-100"
                  aria-label="แจ้งเตือนยอดค้างชำระ"
                >
                  <Bell size={20} />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-medium">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-80 max-h-96 overflow-y-auto shadow-lg border border-gray-200 bg-white scrollbar-gutter-stable"
              >
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>แจ้งเตือนยอดค้างชำระ</span>
                  {pendingCount > 0 && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                      {pendingCount} รายการ
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {loading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    กำลังโหลด...
                  </div>
                ) : pendingBills.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto">
                    {pendingBills.map((bill) => (
                      <DropdownMenuItem key={bill.id} asChild>
                        <Link 
                          href={`/bill/${bill.id}`}
                          className="block p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          onClick={() => setNotificationOpen(false)}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                              <Clock size={16} className="text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {bill.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {bill.participantName ? (
                                  <>ค้างชำระ: {bill.participantName} ฿{formatTHB(bill.amountOwed)}</>
                                ) : (
                                  <>ยอดรวม ฿{formatTHB(bill.totalAmount)}</>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDate(bill.createdAt)}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <CheckCircle2 size={24} className="mx-auto mb-2 text-green-500" />
                    <div>ไม่มียอดค้างชำระ</div>
                    <div className="text-xs mt-1">ยินดีด้วย! คุณชำระเงินครบทุกบิลแล้ว</div>
                  </div>
                )}
                
                {pendingBills.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link 
                        href="/bill-history" 
                        className="text-center text-sm text-primary hover:text-primary-dark"
                        onClick={() => setNotificationOpen(false)}
                      >
                        ดูประวัติบิลทั้งหมด
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* ถ้าล็อกอินแล้ว แสดง Avatar และเมนูผู้ใช้ (ระหว่างรอเช็กการล็อกอินแสดงที่ว่างไว้ก่อน ไม่ให้ปุ่มกระพริบ) */}
          {authLoading ? (
            <div className="h-8 w-8 rounded-full bg-muted" aria-hidden="true" />
          ) : isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="cursor-pointer h-8 w-8">
                  <AvatarImage src={user?.photoURL || ''} />
                  <AvatarFallback>{user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.displayName || user?.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">โปรไฟล์</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bill-history">ประวัติบิล</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">ตั้งค่า</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>ออกจากระบบ</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex space-x-2">
              <Button
                variant="ghost"
                onClick={openLoginModal}
                className="text-sm font-medium"
              >
                เข้าสู่ระบบ
              </Button>
              <Button 
                onClick={openSignupModal}
                className="text-sm font-medium"
              >
                สมัครสมาชิก
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 shadow-lg">
          <div className="container mx-auto px-4 py-3">
            <nav className="flex flex-col space-y-3">
              {mainNavItems.map((item) => (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`text-sm font-medium transition-colors p-2 rounded-md ${
                    pathname === item.href 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-muted-foreground hover:bg-gray-100'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {userRole === 'admin' && (
                <Link 
                  href="/admin" 
                  className={`text-sm font-medium transition-colors p-2 rounded-md ${
                    pathname === '/admin' 
                      ? 'bg-primary/10 text-primary' 
                      : 'text-muted-foreground hover:bg-gray-100'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  หน้า Admin
                </Link>
              )}
              
              {!isAuthenticated && (
                <div className="flex flex-col space-y-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      openLoginModal();
                      setMobileMenuOpen(false);
                    }}
                    className="justify-start text-sm font-medium"
                  >
                    เข้าสู่ระบบ
                  </Button>
                  <Button 
                    onClick={() => {
                      openSignupModal();
                      setMobileMenuOpen(false);
                    }}
                    className="justify-start text-sm font-medium"
                  >
                    สมัครสมาชิก
                  </Button>
                </div>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
} 