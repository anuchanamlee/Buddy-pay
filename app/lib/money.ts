// คำนวณเงินเป็นสตางค์ (จำนวนเต็ม) เพื่อเลี่ยงปัญหาทศนิยมของ JavaScript
// และให้ยอดของทุกคนรวมกันได้เท่ายอดบิลพอดี ไม่ขาดไม่เกินแม้แต่สตางค์เดียว

/** บาท → สตางค์ (ปัดเศษครึ่งขึ้น) */
export function toSatang(baht: number): number {
  if (!Number.isFinite(baht)) return 0;
  // บวก epsilon กันกรณี 1.005 * 100 = 100.49999...
  return Math.round(baht * 100 + Math.sign(baht) * 1e-7);
}

/** สตางค์ → บาท */
export function fromSatang(satang: number): number {
  return satang / 100;
}

/**
 * แบ่งยอด (สตางค์) ตามน้ำหนัก ด้วยวิธีเศษเหลือมากสุด (largest remainder)
 * ผลรวมของผลลัพธ์เท่ากับ total เสมอ เศษสตางค์ที่เหลือจะไปอยู่กับคนที่มีเศษมากที่สุดก่อน
 * ถ้าเศษเท่ากัน คนที่อยู่ลำดับแรกได้ก่อน (ผลลัพธ์จึงเหมือนเดิมทุกครั้ง)
 */
export function allocateSatang(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const safeTotal = Math.max(0, Math.round(total));
  const safeWeights = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const weightSum = safeWeights.reduce((a, b) => a + b, 0);
  if (weightSum === 0 || safeTotal === 0) return new Array(n).fill(0);

  const exact = safeWeights.map((w) => (safeTotal * w) / weightSum);
  const result = exact.map(Math.floor);
  let remaining = safeTotal - result.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v), w: safeWeights[i] }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  for (let k = 0; remaining > 0 && order.length > 0; k = (k + 1) % order.length) {
    result[order[k].i] += 1;
    remaining -= 1;
  }
  return result;
}
