"use client";

import { useRouter } from 'next/navigation';
import { useFirebase } from '../components/providers/FirebaseWrapper';
import { Button } from '@/app/components/ui/Button';
import { useStatistics } from '@/app/hooks/useStatistics';
import { StatisticsCards } from '@/app/components/statistics/StatisticsCards';
import { StatisticsCharts } from '@/app/components/statistics/StatisticsCharts';
import { StatisticsDetails } from '@/app/components/statistics/StatisticsDetails';
import { PendingParticipants } from '@/app/components/statistics/PendingParticipants';
import { calculatePercentage } from '@/app/utils/statistics';
import { useAuthModal } from '../context/AuthModalContext';
import { Badge } from '@/app/components/ui/Badge';
import { AlertCircle, LogIn } from 'lucide-react';
import { StatisticsPageSkeleton } from '../components/SkeletonLoaders';

export default function StatisticsPage() {
  const { user, loading } = useFirebase();
  const router = useRouter();
  const { openLoginModal } = useAuthModal();
  
  const {
    stats,
    isLoading,
    categoryStats,
    popularCategories,
    error
  } = useStatistics(user, loading);

  const Header = ({ subtitle, sample }: { subtitle?: string; sample?: boolean }) => (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold">สถิติการใช้งาน</h1>
          {sample && <Badge variant="outline">ข้อมูลตัวอย่าง</Badge>}
        </div>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push('/share-bill')}>สร้างบิลใหม่</Button>
        <Button variant="outline" onClick={() => router.push('/bill-history')}>ดูประวัติบิล</Button>
      </div>
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="mt-10 first-of-type:mt-0">
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      {children}
    </section>
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

  // Not logged-in but has mock data: เห็นแค่การ์ดสรุปกับกราฟตัวอย่าง ที่เหลือชวนเข้าสู่ระบบ
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <Header sample />

        {stats && (
          <>
            <Section title="ภาพรวม">
              <StatisticsCards stats={stats} />
            </Section>

            <Section title="ค่าใช้จ่ายรายเดือนและตามหมวด">
              <StatisticsCharts stats={stats} categoryStats={categoryStats} />
            </Section>

            <div className="mt-10 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <p className="text-muted-foreground">
                นี่คือข้อมูลตัวอย่าง เข้าสู่ระบบเพื่อดูสถิติบิลของคุณ
              </p>
              <Button onClick={openLoginModal} className="shrink-0">
                <LogIn className="h-4 w-4" aria-hidden />
                เข้าสู่ระบบ
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
        <p className="text-center text-muted-foreground">ยังไม่มีสถิติของคุณ สร้างบิลแรกเพื่อเริ่มดูสถิติ</p>
      </div>
    );
  }

  // Logged-in user with stats
  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <Header />

      {error && (
        <div
          role="alert"
          className="mb-8 flex items-start gap-2 rounded-xl border border-destructive/30 bg-card p-4 text-destructive"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <Section title="ภาพรวม">
        <StatisticsCards stats={stats} />
      </Section>

      <Section title="ค่าใช้จ่ายรายเดือนและตามหมวด">
        <StatisticsCharts stats={stats} categoryStats={categoryStats} />
      </Section>

      <Section title="รายละเอียดเพิ่มเติม">
        <StatisticsDetails
          stats={stats}
          popularCategories={popularCategories}
          calculatePercentage={calculatePercentage}
        />
      </Section>

      {!!stats.pendingParticipants?.length && (
        <Section title="ผู้ร่วมบิลที่รอจ่าย">
          <PendingParticipants
            pendingParticipants={stats.pendingParticipants}
            totalPendingAmount={stats.totalPendingAmount}
          />
        </Section>
      )}
    </div>
  );
}
