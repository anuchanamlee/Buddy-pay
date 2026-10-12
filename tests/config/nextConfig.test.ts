import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '@/next.config';

const ROOT = resolve(__dirname, '../..');

async function getGlobalHeaders(): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const globalRule = rules.find((rule) => rule.source === '/(.*)');
  return Object.fromEntries((globalRule?.headers ?? []).map((h) => [h.key, h.value]));
}

describe('Next.js configuration', () => {
  it('มี config เพียงไฟล์เดียว (ถ้ามี .js/.mjs ด้วย Next.js จะละเลย next.config.ts)', () => {
    const found = ['next.config.js', 'next.config.mjs', 'next.config.cjs', 'next.config.ts'].filter((f) =>
      existsSync(resolve(ROOT, f)),
    );
    expect(found).toEqual(['next.config.ts']);
  });

  it('ส่ง security headers ที่จำเป็นกับทุก path', async () => {
    const headers = await getGlobalHeaders();

    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d+/);
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBeDefined();
    expect(headers['Permissions-Policy']).toBeDefined();
  });

  it('ไม่ส่ง header X-Powered-By', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it('CSP ไม่อนุญาตให้ browser เรียก OpenAI โดยตรง', async () => {
    const headers = await getGlobalHeaders();
    expect(headers['Content-Security-Policy']).not.toContain('openai.com');
  });

  it('ไม่ expose ตัวแปร OpenAI ไปฝั่ง client ผ่าน config.env', () => {
    const envKeys = Object.keys(nextConfig.env ?? {});
    expect(envKeys.filter((key) => key.includes('OPENAI'))).toEqual([]);
  });
});
