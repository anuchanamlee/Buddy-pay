import { z } from 'zod';

// ขีดจำกัดของ request เพื่อควบคุมค่าใช้จ่ายและป้องกัน payload ขนาดใหญ่
const MAX_MESSAGES = 20;
const MAX_USER_MESSAGE_CHARS = 2000;
// คำตอบของบอทถูกส่งกลับมาเป็นประวัติแชท จึงเผื่อความยาวมากกว่าข้อความผู้ใช้
const MAX_ASSISTANT_MESSAGE_CHARS = 4000;

export const CHAT_LIMITS = {
  maxMessages: MAX_MESSAGES,
  maxUserMessageChars: MAX_USER_MESSAGE_CHARS,
  maxAssistantMessageChars: MAX_ASSISTANT_MESSAGE_CHARS,
  // อักษรไทยใช้ 3 bytes ใน UTF-8 จึงคิดจากกรณีที่ทุกข้อความยาวสูงสุด + 16KB สำหรับโครงสร้าง JSON
  maxBodyBytes: MAX_MESSAGES * MAX_ASSISTANT_MESSAGE_CHARS * 3 + 16 * 1024,
} as const;

// รับเฉพาะ role 'user' และ 'assistant' — role 'system' ถูกปฏิเสธ
// เพราะ system prompt ต้องถูกกำหนดโดย server เท่านั้น
const chatMessageSchema = z.discriminatedUnion('role', [
  z
    .object({
      role: z.literal('user'),
      content: z.string().trim().min(1).max(CHAT_LIMITS.maxUserMessageChars),
    })
    .strict(),
  z
    .object({
      role: z.literal('assistant'),
      content: z.string().trim().min(1).max(CHAT_LIMITS.maxAssistantMessageChars),
    })
    .strict(),
]);

export const chatRequestSchema = z
  .object({
    messages: z
      .array(chatMessageSchema)
      .min(1)
      .max(CHAT_LIMITS.maxMessages)
      .refine((messages) => messages[messages.length - 1]?.role === 'user', {
        message: 'ข้อความสุดท้ายต้องมาจากผู้ใช้',
      }),
  })
  .strict();

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
