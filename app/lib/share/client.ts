// สร้างลิงก์แชร์บิลชั่วคราวจากฝั่ง browser (เรียก /api/share/create)
import type { FoodItem, Participant } from '../schema';
import type { SplitResult } from '../billCalculator';

export interface ShareRequest {
  billName: string;
  totalAmount: number;
  vat: number;
  discount: number;
  serviceCharge: number;
  splitMethod: 'equal' | 'itemized';
  categoryId?: string;
  participants: Participant[];
  foodItems: FoodItem[];
  splitResults: SplitResult[];
  promptPayId?: string;
  notes?: string;
}

/** คืน URL ของลิงก์แชร์ หรือโยน Error พร้อมข้อความภาษาไทยที่บอกผู้ใช้ได้ */
export async function createShareLink(data: ShareRequest): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/share/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, promptPayId: data.promptPayId || undefined, notes: data.notes || undefined }),
    });
  } catch {
    throw new Error('เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง');
  }
  const result = await response.json().catch(() => ({}));
  if (response.status === 429) throw new Error('สร้างลิงก์บ่อยเกินไป รอสักครู่แล้วลองใหม่');
  if (!response.ok || !result?.shareUrl) throw new Error(result?.error || 'สร้างลิงก์ไม่สำเร็จ ลองอีกครั้ง');
  return result.shareUrl as string;
}

/** ลิงก์เปิดแอป LINE พร้อมข้อความ */
export function lineShareUrl(billName: string, shareUrl: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(`หารบิล ${billName}: ดูยอดที่ต้องจ่ายได้ที่ ${shareUrl}`)}`;
}
