import { describe, expect, it, vi } from 'vitest';
import { getClientIp, handleCreateShare, handleGetShare, type CreateShareDependencies } from '@/app/lib/share/handlers';
import { SHARE_LIMITS, type ShareDocument } from '@/app/lib/share/schema';
import { createRateLimiter } from '@/app/lib/rateLimit';
import { realisticPayload } from './fixtures';

const SHARE_ID = '0123456789abcdef0123456789abcdef';
const NOW = new Date('2026-01-01T00:00:00.000Z');

function postRequest(body: unknown, ip = '203.0.113.1') {
  return new Request('http://localhost/api/share/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function makeDeps(overrides: Partial<CreateShareDependencies> = {}) {
  const saved: { id?: string; doc?: ShareDocument } = {};
  const deps: CreateShareDependencies = {
    saveShare: vi.fn(async (id, doc) => {
      saved.id = id;
      saved.doc = doc;
    }),
    generateShareId: () => SHARE_ID,
    rateLimiter: createRateLimiter({ limit: 100, windowMs: 60_000 }),
    appUrl: 'https://buddypay.example',
    now: () => NOW,
    logError: vi.fn(),
    ...overrides,
  };
  return { deps, saved };
}

describe('POST /api/share/create', () => {
  it('สร้างลิงก์และคืน URL พร้อมวันหมดอายุ 24 ชม.', async () => {
    const { deps } = makeDeps();
    const res = await handleCreateShare(postRequest(realisticPayload()), deps);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      shareUrl: `https://buddypay.example/share/${SHARE_ID}`,
      shareId: SHARE_ID,
      expiryDate: '2026-01-02T00:00:00.000Z',
      isTemporary: true,
    });
  });

  it('เก็บเฉพาะฟิลด์ใน allowlist: ตัด bills, participantGroups, toast, isLoading ทิ้ง', async () => {
    const { deps, saved } = makeDeps();
    await handleCreateShare(postRequest(realisticPayload()), deps);

    expect(saved.doc).toBeDefined();
    expect(Object.keys(saved.doc!).sort()).toEqual(
      [
        'billName', 'totalAmount', 'vat', 'discount', 'serviceCharge', 'splitMethod', 'categoryId',
        'participants', 'foodItems', 'splitResults', 'promptPayId', 'qrPayload', 'notes',
        'shareId', 'createdAt', 'expiryDate', 'expiresAt', 'isTemporary', 'type',
      ].sort(),
    );
    expect(JSON.stringify(saved.doc)).not.toContain('private-bill');
    expect(saved.doc!.expiresAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });

  it('ตัดฟิลด์แปลกปลอมใน object ย่อยด้วย', async () => {
    const { deps, saved } = makeDeps();
    await handleCreateShare(
      postRequest(realisticPayload({ participants: [{ id: 'p1', name: 'เอ', email: 'a@example.com', isAdmin: true }] })),
      deps,
    );
    expect(saved.doc!.participants).toEqual([{ id: 'p1', name: 'เอ', status: 'pending' }]);
  });

  it.each([
    ['ไม่มีชื่อบิล', { billName: '' }],
    ['ไม่มีผู้ร่วมจ่าย', { participants: [] }],
    ['splitMethod ไม่ถูกต้อง', { splitMethod: 'random' }],
    ['ราคาติดลบ', { foodItems: [{ id: 'f1', name: 'x', price: -1, participants: [] }] }],
    ['ผู้ร่วมจ่ายเกินกำหนด', { participants: Array.from({ length: 51 }, (_, i) => ({ id: `p${i}`, name: `p${i}` })) }],
    ['โน้ตยาวเกินกำหนด', { notes: 'x'.repeat(SHARE_LIMITS.maxNotesChars + 1) }],
    ['VAT เกิน 100%', { vat: 150 }],
  ])('ตอบ 400 เมื่อ%s และไม่บันทึกข้อมูล', async (_label, override) => {
    const { deps } = makeDeps();
    const res = await handleCreateShare(postRequest(realisticPayload(override)), deps);
    expect(res.status).toBe(400);
    expect(deps.saveShare).not.toHaveBeenCalled();
  });

  it('ตอบ 400 เมื่อ JSON เสีย', async () => {
    const { deps } = makeDeps();
    expect((await handleCreateShare(postRequest('{oops'), deps)).status).toBe(400);
  });

  it('ตอบ 413 เมื่อ body ใหญ่เกินกำหนด', async () => {
    const { deps } = makeDeps();
    const res = await handleCreateShare(postRequest('x'.repeat(SHARE_LIMITS.maxBodyBytes + 1)), deps);
    expect(res.status).toBe(413);
    expect(deps.saveShare).not.toHaveBeenCalled();
  });

  it('ตอบ 429 เมื่อ IP เดียวกันสร้างลิงก์ถี่เกินกำหนด แต่ IP อื่นยังสร้างได้', async () => {
    const { deps } = makeDeps({ rateLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }) });

    expect((await handleCreateShare(postRequest(realisticPayload(), '198.51.100.7'), deps)).status).toBe(200);
    const limited = await handleCreateShare(postRequest(realisticPayload(), '198.51.100.7'), deps);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((await handleCreateShare(postRequest(realisticPayload(), '198.51.100.8'), deps)).status).toBe(200);
  });

  it('ตอบ 500 แบบไม่เปิดเผยรายละเอียด และไม่ log ข้อมูลบิล เมื่อบันทึกล้มเหลว', async () => {
    const { deps } = makeDeps({
      saveShare: vi.fn(async () => {
        throw Object.assign(new Error('PERMISSION_DENIED: 0812345678'), { code: 'permission-denied' });
      }),
    });
    const res = await handleCreateShare(postRequest(realisticPayload()), deps);

    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('PERMISSION_DENIED');
    expect(deps.logError).toHaveBeenCalledWith('failed to save share', { code: 'permission-denied' });
  });
});

describe('GET /api/share/[id]', () => {
  const stored = {
    billName: 'หมูกระทะ',
    shareId: SHARE_ID,
    createdAt: '2026-01-01T00:00:00.000Z',
    expiryDate: '2026-01-02T00:00:00.000Z',
    expiresAt: { toDate: () => new Date('2026-01-02T00:00:00.000Z') },
    isTemporary: true,
  };

  it('ตอบ 400 เมื่อ ID ไม่ใช่ hex 32 ตัว โดยไม่อ่านฐานข้อมูล', async () => {
    const loadShare = vi.fn();
    const res = await handleGetShare('../users/admin', { loadShare });
    expect(res.status).toBe(400);
    expect(loadShare).not.toHaveBeenCalled();
  });

  it('ตอบ 404 เมื่อไม่พบลิงก์', async () => {
    const res = await handleGetShare(SHARE_ID, { loadShare: async () => null, now: () => NOW });
    expect(res.status).toBe(404);
  });

  it('คืนข้อมูลบิลเมื่อยังไม่หมดอายุ', async () => {
    const res = await handleGetShare(SHARE_ID, { loadShare: async () => stored, now: () => NOW });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.billName).toBe('หมูกระทะ');
    expect(body.data).not.toHaveProperty('expiresAt');
    expect(body.expiryDate).toBe('2026-01-02T00:00:00.000Z');
  });

  it('ตอบ 410 เมื่อหมดอายุ โดยไม่พยายามลบเอกสาร', async () => {
    const res = await handleGetShare(SHARE_ID, {
      loadShare: async () => stored,
      now: () => new Date('2026-01-03T00:00:00.000Z'),
    });
    expect(res.status).toBe(410);
  });

  it('รองรับลิงก์เก่าที่มีแค่ expiryDate (string)', async () => {
    const { expiresAt: _omit, ...legacy } = stored;
    void _omit;
    const res = await handleGetShare(SHARE_ID, { loadShare: async () => legacy, now: () => NOW });
    expect(res.status).toBe(200);
  });

  it('ตอบ 500 แบบไม่เปิดเผยรายละเอียดเมื่ออ่านฐานข้อมูลล้มเหลว', async () => {
    const res = await handleGetShare(SHARE_ID, {
      loadShare: async () => {
        throw new Error('internal');
      },
      logError: vi.fn(),
    });
    expect(res.status).toBe(500);
  });
});

describe('getClientIp', () => {
  it('ใช้ IP แรกใน x-forwarded-for', () => {
    const req = new Request('http://x', { headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' } });
    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  it('คืน unknown เมื่อไม่มี header', () => {
    expect(getClientIp(new Request('http://x'))).toBe('unknown');
  });
});
