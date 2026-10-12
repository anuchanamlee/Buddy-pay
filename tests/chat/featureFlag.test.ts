import { afterEach, describe, expect, it } from 'vitest';
import { isAiChatEnabled } from '@/app/lib/chat/featureFlag';
import { POST } from '@/app/api/chat/route';

const ORIGINAL_ENV = { ...process.env };

function chatRequest() {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer some-token' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  });
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('isAiChatEnabled', () => {
  it('ปิดเป็นค่าเริ่มต้นเมื่อไม่ได้กำหนด ENABLE_AI_CHAT', () => {
    expect(isAiChatEnabled({})).toBe(false);
  });

  it.each(['false', 'FALSE', '1', 'yes', 'True', ''])('ถือว่าปิดเมื่อ ENABLE_AI_CHAT=%j', (value) => {
    expect(isAiChatEnabled({ ENABLE_AI_CHAT: value })).toBe(false);
  });

  it('เปิดเมื่อ ENABLE_AI_CHAT=true เท่านั้น', () => {
    expect(isAiChatEnabled({ ENABLE_AI_CHAT: 'true' })).toBe(true);
  });
});

describe('POST /api/chat เมื่อปิดฟีเจอร์', () => {
  it('ตอบ 503 เมื่อไม่ได้เปิด flag และไม่มี OPENAI_API_KEY', async () => {
    delete process.env.ENABLE_AI_CHAT;
    delete process.env.OPENAI_API_KEY;

    const res = await POST(chatRequest());
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'chatbot_disabled' });
  });

  it('ยังตอบ 503 แม้เปิด flag แต่ยังไม่มี OPENAI_API_KEY', async () => {
    process.env.ENABLE_AI_CHAT = 'true';
    delete process.env.OPENAI_API_KEY;

    const res = await POST(chatRequest());
    expect(res.status).toBe(503);
  });
});
