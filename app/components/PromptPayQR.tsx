'use client';

import { useMemo, useState } from 'react';
import QRCode from 'react-qr-code';
import generatePayload from 'promptpay-qr';
import { formatTHB } from '@/app/lib/format';

/** เลขพร้อมเพย์ที่ใช้ได้: เบอร์มือถือ 10 หลัก หรือเลขประจำตัว 13 หลัก */
export function sanitizePromptPayId(id: string | undefined | null): string | null {
  const digits = (id || '').replace(/[^0-9]/g, '');
  return digits.length === 10 || digits.length === 13 ? digits : null;
}

/** สร้าง payload ของ QR พร้อมเพย์ที่ระบุยอดเงิน (ยอด 0 = ให้ผู้โอนกรอกเอง) */
export function buildPromptPayPayload(id: string, amount: number): string | null {
  const clean = sanitizePromptPayId(id);
  if (!clean) return null;
  try {
    const rounded = Math.max(0, Math.round(amount * 100) / 100);
    return generatePayload(clean, rounded > 0 ? { amount: rounded } : {});
  } catch {
    return null;
  }
}

type Person = { id: string; name: string; amount: number; paid?: boolean };

/**
 * QR พร้อมเพย์แยกตามคน: เลือกชื่อแล้วได้ QR ที่ใส่ยอดของคนนั้นไว้แล้ว เพื่อนสแกนจ่ายได้ทันที
 */
export function PerPersonPromptPayQR({ promptPayId, people, size = 168 }: { promptPayId: string; people: Person[]; size?: number }) {
  const payable = people.filter((p) => p.amount > 0);
  const firstUnpaid = payable.find((p) => !p.paid) ?? payable[0];
  const [selectedId, setSelectedId] = useState<string | undefined>(firstUnpaid?.id);
  const selected = payable.find((p) => p.id === selectedId) ?? firstUnpaid;

  const payload = useMemo(
    () => (selected ? buildPromptPayPayload(promptPayId, selected.amount) : null),
    [promptPayId, selected],
  );

  if (!sanitizePromptPayId(promptPayId) || !selected) return null;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="เลือกคนที่จะจ่าย">
        {payable.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === selected.id}
            onClick={() => setSelectedId(p.id)}
            className={`min-h-[36px] px-3 rounded-full text-sm border transition-colors ${
              p.id === selected.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            {p.name}
            {p.paid ? ' ✓' : ''}
          </button>
        ))}
      </div>

      {payload && (
        <div className="bg-white p-3 rounded-lg shadow-sm">
          <QRCode value={payload} size={size} level="M" aria-label={`QR พร้อมเพย์สำหรับ ${selected.name}`} />
        </div>
      )}

      <p className="text-center text-sm text-gray-700">
        <span className="font-semibold">{selected.name}</span> สแกนจ่าย{' '}
        <span className="font-bold text-blue-700 tabular-nums">{formatTHB(selected.amount)} บาท</span>
        {selected.paid && <span className="block text-green-600 text-xs mt-1">จ่ายแล้ว</span>}
      </p>
    </div>
  );
}
