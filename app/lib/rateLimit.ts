/**
 * Rate limiter แบบ fixed window เก็บสถานะในหน่วยความจำของ process
 *
 * ข้อจำกัด: ถ้า deploy แบบ serverless หรือหลาย instance แต่ละ instance
 * จะนับแยกกันและค่าจะหายเมื่อ instance ถูกปิด ถ้าต้องการจำกัดแบบแม่นยำ
 * ควรย้ายไปเก็บใน store กลาง เช่น Redis หรือ Firestore
 */
export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = {
  check: (key: string) => RateLimitResult;
};

type Options = {
  limit: number;
  windowMs: number;
  now?: () => number;
  maxKeys?: number;
};

export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 10_000 }: Options): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  // ลบ window ที่หมดอายุแล้ว เพื่อไม่ให้ Map โตไม่จำกัด
  const prune = (current: number) => {
    windows.forEach((entry, key) => {
      if (entry.resetAt <= current) windows.delete(key);
    });
  };

  return {
    check(key) {
      const current = now();
      let entry = windows.get(key);

      if (!entry || entry.resetAt <= current) {
        if (windows.size >= maxKeys) prune(current);
        entry = { count: 0, resetAt: current + windowMs };
        windows.set(key, entry);
      }

      if (entry.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - current) / 1000) };
      }

      entry.count += 1;
      return { allowed: true, remaining: limit - entry.count };
    },
  };
}
