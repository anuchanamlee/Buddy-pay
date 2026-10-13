'use client';

import React, { useEffect } from 'react';
import ErrorDashboard from '../components/ErrorDashboard';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AdminErrorsPage() {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  // รอเช็กการล็อกอินและ role ก่อนค่อยตัดสินใจพาออก (เดิมพาออกทันทีตอนที่ยังไม่รู้ว่าเป็นใคร)
  const roleKnown = !loading && (!user || userRole !== null);
  const allowed = !!user && userRole === 'admin';

  useEffect(() => {
    if (roleKnown && !allowed) router.replace('/');
  }, [roleKnown, allowed, router]);

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto">
        <ErrorDashboard />
      </div>
    </div>
  );
} 