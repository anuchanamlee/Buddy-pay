import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Firestore Security Rules tests: ต้องรันผ่าน `npm run test:rules`
// ซึ่งเปิด Firestore Emulator ให้ก่อน (ไม่เชื่อมต่อ Firebase project จริง)
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    // ทุกไฟล์ใช้ Emulator ตัวเดียวกัน จึงรันทีละไฟล์เพื่อไม่ให้ข้อมูลชนกัน
    fileParallelism: false,
  },
});
