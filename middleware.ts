import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


export async function middleware(req: NextRequest) {
  // เส้นทางทั้งหมดที่ต้องการการตรวจสอบสิทธิ์
  const protectedPaths = ['/admin', '/profile', '/settings', '/api/protected'];
  const isProtectedPath = protectedPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  );
  
  // ถ้าไม่ใช่เส้นทางที่ต้องการการตรวจสอบสิทธิ์ ให้ผ่านไปได้เลย
  if (!isProtectedPath) {
    return NextResponse.next();
  }
  
  // ตรวจสอบจาก session storage
  const sessionCookie = req.cookies.get('firebase-session');
  
  // หากไม่มี cookie
  if (!sessionCookie) {
    // ถ้าเป็นการเรียก API
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // ถ้าเป็นหน้าทั่วไป ให้กลับหน้าแรกพร้อมเปิด modal ล็อกอิน (แอปไม่มีหน้า /login แยก)
    const loginUrl = new URL('/', req.url);
    loginUrl.searchParams.set('login', '1');
    loginUrl.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // ตรวจสอบสิทธิ์สำหรับหน้า admin
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const userRole = req.cookies.get('user-role')?.value;
    
    if (userRole !== 'admin') {
      // แอปไม่มีหน้า /dashboard จึงส่งกลับหน้าแรก
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/settings/:path*',
    '/profile/:path*',
    '/api/protected/:path*',
  ],
}; 