'use client';

import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { parseAmount, sanitizeDecimal } from '@/app/lib/numericInput';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> & {
  value: number;
  onValueChange: (value: number) => void;
};

/** ช่องจำนวนเงิน: พิมพ์ได้เฉพาะตัวเลขกับจุดทศนิยม พิมพ์ "12." ค้างไว้ได้ระหว่างพิมพ์ */
export function AmountInput({ value, onValueChange, ...rest }: Props) {
  const [text, setText] = useState(value ? String(value) : '');

  // ค่าถูกเปลี่ยนจากที่อื่น (เช่นโหลดบิลใหม่) ให้ช่องแสดงตาม
  useEffect(() => {
    setText((current) => ((parseAmount(current) || 0) === value ? current : value ? String(value) : ''));
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const next = sanitizeDecimal(e.target.value);
        setText(next);
        const n = parseAmount(next);
        onValueChange(Number.isFinite(n) ? n : 0);
      }}
    />
  );
}
