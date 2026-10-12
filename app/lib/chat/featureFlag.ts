/**
 * Feature flag ของ AI Chatbot (ปิดเป็นค่าเริ่มต้น)
 *
 * เปิดได้เมื่อกำหนด ENABLE_AI_CHAT=true เท่านั้น ค่าอื่นหรือไม่กำหนดถือว่าปิด
 * อ่านได้เฉพาะฝั่ง server (ไม่มี prefix NEXT_PUBLIC_) ใช้ทั้งใน app/layout.tsx
 * เพื่อซ่อน UI และใน /api/chat เพื่อปิด endpoint
 */
export function isAiChatEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ENABLE_AI_CHAT === 'true';
}
