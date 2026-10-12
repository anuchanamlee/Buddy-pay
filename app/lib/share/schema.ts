import { z } from 'zod';

/**
 * ขีดจำกัดของลิงก์แชร์บิลชั่วคราว
 * ต้องสอดคล้องกับ rules ของ temporary_shared_bills ใน firestore.rules
 */
export const SHARE_LIMITS = {
  maxBodyBytes: 256 * 1024,
  maxParticipants: 50,
  maxFoodItems: 200,
  maxItemsPerResult: 250,
  maxNameChars: 200,
  maxNotesChars: 1000,
  maxPromptPayIdChars: 20,
  maxQrPayloadChars: 512,
  ttlHours: 24,
} as const;

export const SHARE_ID_PATTERN = /^[0-9a-f]{32}$/;

const money = z.number().finite().min(0).max(1_000_000_000);
const percent = z.number().finite().min(0).max(100);
const shortText = z.string().max(SHARE_LIMITS.maxNameChars);

// object ย่อยใช้ค่าเริ่มต้นของ zod คือ "strip" ฟิลด์ที่ไม่รู้จักจะถูกตัดทิ้ง ไม่ถูกเก็บ
const participantSchema = z.object({
  id: shortText.min(1),
  name: shortText.min(1),
  status: z.enum(['paid', 'pending']).default('pending'),
});

const foodItemSchema = z.object({
  id: shortText.min(1),
  name: shortText.min(1),
  price: money,
  participants: z.array(shortText).max(SHARE_LIMITS.maxParticipants),
});

const splitResultSchema = z.object({
  participant: participantSchema,
  amount: z.number().finite().min(-1_000_000_000).max(1_000_000_000),
  items: z
    .array(z.object({ name: shortText, amount: z.number().finite() }))
    .max(SHARE_LIMITS.maxItemsPerResult),
});

/**
 * ข้อมูลที่อนุญาตให้เก็บในลิงก์แชร์ (allowlist)
 * client เดิมส่ง BillState ทั้งก้อน ซึ่งมี bills (ประวัติบิลทั้งหมดของผู้ใช้),
 * participantGroups, toast ฯลฯ ฟิลด์เหล่านี้จะถูกตัดทิ้งก่อนบันทึก
 */
export const shareBillSchema = z.object({
  billName: shortText.trim().min(1),
  totalAmount: money,
  vat: percent.default(0),
  discount: money.default(0),
  serviceCharge: percent.default(0),
  splitMethod: z.enum(['equal', 'itemized']),
  categoryId: z.string().max(100).optional(),
  participants: z.array(participantSchema).min(1).max(SHARE_LIMITS.maxParticipants),
  foodItems: z.array(foodItemSchema).max(SHARE_LIMITS.maxFoodItems),
  splitResults: z.array(splitResultSchema).max(SHARE_LIMITS.maxParticipants).default([]),
  promptPayId: z.string().max(SHARE_LIMITS.maxPromptPayIdChars).optional(),
  qrPayload: z.string().max(SHARE_LIMITS.maxQrPayloadChars).optional(),
  notes: z.string().max(SHARE_LIMITS.maxNotesChars).optional(),
});

export type ShareBillInput = z.infer<typeof shareBillSchema>;

export type ShareDocument = ShareBillInput & {
  shareId: string;
  createdAt: string;
  expiryDate: string;
  // เก็บเป็น Date เพื่อให้ Firestore บันทึกเป็น Timestamp ซึ่ง Rules ตรวจและใช้ทำ TTL ได้
  expiresAt: Date;
  isTemporary: true;
  type: 'temp_share';
};
