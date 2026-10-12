import { NextRequest } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { handleGetShare } from '@/app/lib/share/handlers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!db) {
    return Response.json({ error: 'ระบบแชร์บิลยังไม่พร้อมใช้งาน' }, { status: 503 });
  }

  const { id } = await params;
  return handleGetShare(id, {
    loadShare: async (shareId) => {
      const snapshot = await getDoc(doc(db, 'temporary_shared_bills', shareId));
      return snapshot.exists() ? snapshot.data() : null;
    },
    logError: (message, meta) => console.error(`[api/share/[id]] ${message}`, meta),
  });
}
