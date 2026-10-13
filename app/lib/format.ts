// ตัวจัดรูปแบบกลางสำหรับวันที่และจำนวนเงิน ใช้ที่เดียวทั้งแอปเพื่อให้แสดงผลเหมือนกันทุกหน้า

type DateLike =
  | Date
  | string
  | number
  | { toDate: () => Date }
  | { seconds: number; nanoseconds?: number }
  | null
  | undefined;

/** แปลงค่าวันที่ทุกรูปแบบที่พบในแอป (Date, Firestore Timestamp, ข้อมูลจากแคชที่เป็น string/number) เป็น Date */
export function toDate(input: DateLike): Date | null {
  if (input === null || input === undefined) return null;

  let date: Date | null = null;
  if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'string' || typeof input === 'number') {
    date = new Date(input);
  } else if (typeof input === 'object' && 'toDate' in input && typeof input.toDate === 'function') {
    date = input.toDate();
  } else if (typeof input === 'object' && 'seconds' in input && typeof input.seconds === 'number') {
    date = new Date(input.seconds * 1000);
  }

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

const thaiDateTime = new Intl.DateTimeFormat('th-TH', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const thaiDate = new Intl.DateTimeFormat('th-TH', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

/** วันที่ภาษาไทย เช่น "12 ต.ค. 2569 22:09" */
export function formatThaiDate(input: DateLike, { withTime = true } = {}): string {
  const date = toDate(input);
  if (!date) return 'ไม่ระบุวันที่';
  return (withTime ? thaiDateTime : thaiDate).format(date);
}

const thb = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** จำนวนเงินบาท แสดงทศนิยมเมื่อมีสตางค์ เช่น 130 → "130", 133.335 → "133.34" */
export function formatTHB(amount: number | null | undefined): string {
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  return thb.format(value);
}
