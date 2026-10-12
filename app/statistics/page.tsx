"use client";

import { useRouter } from 'next/navigation';
import { useFirebase } from '../components/providers/FirebaseWrapper';
import { Button } from '@/app/components/ui/Button';
import { useStatistics } from '@/app/hooks/useStatistics';
import { StatisticsCards } from '@/app/components/statistics/StatisticsCards';
import { StatisticsCharts } from '@/app/components/statistics/StatisticsCharts';
import { StatisticsDetails } from '@/app/components/statistics/StatisticsDetails';
import { PendingParticipants } from '@/app/components/statistics/PendingParticipants';
import { renderSafeAmount, calculatePercentage } from '@/app/utils/statistics';
import LoginPrompt from '../components/LoginPrompt';
import { StatisticsPageSkeleton } from '../components/SkeletonLoaders';

export default function StatisticsPage() {
  const { user, loading } = useFirebase();
  const router = useRouter();
  
  const {
    stats,
    isLoading,
    categoryStats,
    popularCategories,
    error
  } = useStatistics(user, loading);

  // Header + Quick actions
  const Header = ({ subtitle }: { subtitle?: string }) => (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl font-bold">สถิติการใช้งาน</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={() => router.push('/share-bill')}>สร้างบิลใหม่</Button>
        <Button variant="outline" onClick={() => router.push('/bill-history')}>ดูประวัติบิล</Button>
      </div>
    </div>
  );

  // Loading states
  if (!user && !stats) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <Header subtitle="กำลังโหลดข้อมูลตัวอย่าง..." />
      </div>
    );
  }

  if (loading || (isLoading && user)) {
    return <StatisticsPageSkeleton />;
  }

  // Not logged-in but has mock data
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <Header />
        <LoginPrompt message="คุณกำลังดูข้อมูลตัวอย่าง" />

        {stats && (
          <>
            {/* 1) สรุปภาพรวม */}
            <section className="mt-6">
              <h2 className="text-xl font-semibold mb-3">
                ภาพรวม{' '}
                <span className="ml-1 align-middle rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  ข้อมูลตัวอย่าง
                </span>
              </h2>
              <StatisticsCards stats={stats} renderSafeAmount={renderSafeAmount} />
            </section>

            {/* 2) ค่าใช้จ่ายตามหมวด */}
            <section className="mt-10">
              <h2 className="text-xl font-semibold mb-3">ค่าใช้จ่ายตามหมวดหมู่</h2>
              <StatisticsCharts stats={stats} categoryStats={categoryStats} />
            </section>

            {/* 3) รายละเอียดเพิ่มเติม */}
            <section className="mt-10">
              <h2 className="text-xl font-semibold mb-3">รายละเอียดเพิ่มเติม</h2>
              <StatisticsDetails
                stats={stats}
                popularCategories={popularCategories}
                renderSafeAmount={renderSafeAmount}
                calculatePercentage={calculatePercentage}
              />
            </section>

            {/* 4) ผู้ร่วมบิลที่รอชำระ (ล่างสุด) */}
            {!!stats.pendingParticipants?.length && (
              <section className="mt-10">
                <h2 className="text-xl font-semibold mb-3">ผู้ร่วมบิลที่รอชำระ</h2>
                <PendingParticipants
                  pendingParticipants={stats.pendingParticipants}
                  totalPendingAmount={stats.totalPendingAmount}
                />
              </section>
            )}

            {/* CTA ล่าง */}
            <div className="text-center mt-12">
              <Button onClick={() => router.push('/share-bill')} className="mx-2">
                สร้างบิลใหม่
              </Button>
              <Button variant="outline" onClick={() => router.push('/bill-history')} className="mx-2">
                ดูประวัติบิล
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  // No stats for logged-in user
  if (!stats) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <Header />
        <div className="text-center">
          <p className="text-muted-foreground mb-6">ไม่พบข้อมูลสถิติของคุณ</p>
          <Button onClick={() => router.push('/share-bill')}>สร้างบิลใหม่</Button>
        </div>
      </div>
    );
  }

  // Logged-in user with stats
  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <Header />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md mb-8">
          {error}
        </div>
      )}

      {/* 1) สรุปภาพรวม */}
      <section>
        <h2 className="text-xl font-semibold mb-3">ภาพรวม</h2>
        <StatisticsCards stats={stats} renderSafeAmount={renderSafeAmount} />
      </section>

      {/* 2) ค่าใช้จ่ายตามหมวด */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3">ค่าใช้จ่ายตามหมวดหมู่</h2>
        <StatisticsCharts stats={stats} categoryStats={categoryStats} />
      </section>

      {/* 3) รายละเอียดเพิ่มเติม */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-3">รายละเอียดเพิ่มเติม</h2>
        <StatisticsDetails
          stats={stats}
          popularCategories={popularCategories}
          renderSafeAmount={renderSafeAmount}
          calculatePercentage={calculatePercentage}
        />
      </section>

      {/* 4) ผู้ร่วมบิลที่รอชำระ (ล่างสุด) */}
      {!!stats.pendingParticipants?.length && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-3">ผู้ร่วมบิลที่รอชำระ</h2>
          <PendingParticipants
            pendingParticipants={stats.pendingParticipants}
            totalPendingAmount={stats.totalPendingAmount}
          />
        </section>
      )}

      {/* CTA ล่าง */}
      <div className="text-center mt-12">
        <Button onClick={() => router.push('/share-bill')} className="mx-2">
          สร้างบิลใหม่
        </Button>
        <Button variant="outline" onClick={() => router.push('/bill-history')} className="mx-2">
          ดูประวัติบิล
        </Button>
      </div>
    </div>
  );
}
