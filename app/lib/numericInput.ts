// กรองสิ่งที่พิมพ์ในช่องตัวเลข ให้รับได้เฉพาะตัวเลขตั้งแต่ตอนพิมพ์/วาง (เดิมพิมพ์ตัวอักษรได้แต่กดเพิ่มไม่ได้ ผู้ใช้งง)
// แปลงเลขไทย (๐-๙) และเลขเต็มความกว้าง (０-９) เป็นเลขอารบิกให้ด้วย

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const MAX_INTEGER_DIGITS = 9; // สูงสุด 999,999,999 บาท

function normalizeDigits(text: string): string {
  return text
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10))
    .replace(/[．。]/g, '.');
}

/** ช่องจำนวนเงิน/เปอร์เซ็นต์: เหลือเฉพาะตัวเลขกับจุดทศนิยม 1 จุด ทศนิยมไม่เกิน `decimals` ตำแหน่ง */
export function sanitizeDecimal(text: string, decimals = 2): string {
  const cleaned = normalizeDigits(text).replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  let intPart = dot === -1 ? cleaned : cleaned.slice(0, dot);
  intPart = intPart.replace(/^0+(?=\d)/, '').slice(0, MAX_INTEGER_DIGITS);
  if (dot === -1 || decimals <= 0) return intPart;
  const fraction = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, decimals);
  return `${intPart || '0'}.${fraction}`;
}

/** ช่องที่รับเฉพาะตัวเลข (เช่นพร้อมเพย์) ยอมให้มีขีดคั่นได้ ไม่เกิน `maxDigits` ตัวเลข */
export function sanitizeDigits(text: string, maxDigits = 13, allowDash = true): string {
  const cleaned = normalizeDigits(text).replace(allowDash ? /[^0-9-]/g : /[^0-9]/g, '');
  let digits = 0;
  let out = '';
  for (const ch of cleaned) {
    if (ch === '-') {
      if (out && !out.endsWith('-')) out += ch;
      continue;
    }
    if (digits >= maxDigits) break;
    digits++;
    out += ch;
  }
  return out;
}

/** แปลงข้อความในช่องจำนวนเงินเป็นตัวเลข ข้อความที่ไม่ใช่ตัวเลขล้วนได้ NaN (เดิม "12abc" ได้ 12) */
export function parseAmount(text: string): number {
  const t = normalizeDigits(text).replace(/[,\s]/g, '');
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return Number.NaN;
  return Number.parseFloat(t);
}
