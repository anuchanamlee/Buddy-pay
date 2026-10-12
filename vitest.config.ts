import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests ที่รันได้โดยไม่ต้องใช้ Firebase หรือ credentials ใด ๆ
// (Firestore Rules tests แยกไปที่ vitest.rules.config.ts เพราะต้องใช้ Emulator)
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/rules/**', 'node_modules/**'],
  },
});
