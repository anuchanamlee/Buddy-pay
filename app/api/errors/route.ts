import { NextResponse } from 'next/server';

/**
 * ปิดใช้งาน: เดิม endpoint นี้รับ error report จากใครก็ได้โดยไม่จำกัด
 * และพยายามเขียนลง Firestore ซึ่ง Rules ปฏิเสธมาตลอด (ไม่มีข้อมูลถูกบันทึกจริง)
 * ตอนนี้ error จะแสดงให้ผู้ใช้เห็นผ่าน ErrorBoundary / ErrorFallback ใน browser แทน
 */
function gone() {
  return NextResponse.json(
    { error: 'This endpoint has been removed. Errors are shown to the user in the app.' },
    { status: 410 }
  );
}

export const GET = gone;
export const POST = gone;
