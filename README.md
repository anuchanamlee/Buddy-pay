# BuddyPay

เว็บแอปสำหรับ **แบ่งบิลค่าอาหารและค่าใช้จ่ายระหว่างเพื่อน** คำนวณ VAT ค่าบริการ และส่วนลด สร้าง QR PromptPay สำหรับรับเงิน แชร์ผลลัพธ์ผ่านลิงก์ และติดตามว่าใครยังค้างจ่าย

สร้างด้วย Next.js 15 (App Router), React 19, TypeScript และ Firebase (Authentication + Firestore)

> **สถานะ:** โปรเจกต์ส่วนตัวสำหรับ Portfolio **ยังไม่พร้อมใช้งาน Production** ดูรายละเอียดที่ [ข้อจำกัดที่ทราบ](#ข้อจำกัดที่ทราบ)

---

## สารบัญ

- [ฟีเจอร์](#ฟีเจอร์)
- [สถาปัตยกรรม](#สถาปัตยกรรม)
- [โมเดลความปลอดภัย](#โมเดลความปลอดภัย)
- [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
- [การติดตั้งและรันในเครื่อง](#การติดตั้งและรันในเครื่อง)
- [การทดสอบ](#การทดสอบ)
- [CI](#ci)
- [การ Deploy](#การ-deploy)
- [ข้อจำกัดที่ทราบ](#ข้อจำกัดที่ทราบ)
- [แนวทางพัฒนาต่อ](#แนวทางพัฒนาต่อ)

---

## ฟีเจอร์

| ฟีเจอร์ | รายละเอียด | ไฟล์หลัก |
|---|---|---|
| สร้างบิลแบบหลายขั้นตอน | กรอกรายละเอียดบิล → ผู้ร่วมจ่าย → วิธีหาร → รายการอาหาร → คนที่กินแต่ละรายการ → ผลลัพธ์ | `app/share-bill/page.tsx`, `app/components/BillSteps/` |
| คำนวณการหารบิล | **หารเท่ากัน** หรือ **หารตามรายการที่กิน** (VAT ค่าบริการ และส่วนลดกระจายตามสัดส่วนค่าอาหารของแต่ละคน) | `app/lib/billCalculator.ts` |
| QR PromptPay | สร้าง QR สำหรับรับเงินจากเบอร์โทรหรือเลขบัตรประชาชน | `promptpay-qr`, `ResultStep.tsx` |
| ลิงก์แชร์ชั่วคราว | แชร์ผลการหารบิลได้โดยไม่ต้องล็อกอิน ลิงก์มีอายุ 24 ชั่วโมง | `app/api/share/`, `app/lib/share/` |
| บันทึกและประวัติบิล | บันทึกบิลลง Firestore ดูย้อนหลังแบบแบ่งหน้า เปลี่ยนสถานะการจ่าย และลบบิล | `app/bill-history/`, `app/bill/[id]/` |
| ผู้ค้างชำระ | สรุปว่าใครยังไม่จ่ายและยอดเท่าไร ทั้งในหน้าสถิติและแจ้งเตือนบน Navbar (real-time) | `app/hooks/useStatistics.ts`, `app/components/Navbar.tsx` |
| สถิติการใช้จ่าย | กราฟรายเดือนและแยกตามหมวดหมู่ (Recharts) | `app/statistics/` |
| กลุ่มผู้ร่วมจ่าย | บันทึกรายชื่อเพื่อนเป็นกลุ่ม เพื่อเลือกใช้ซ้ำ | `app/lib/services/participantGroupService.ts` |
| เข้าสู่ระบบ | Email/Password และ Google Sign-in ผ่าน Firebase Authentication | `app/components/providers/FirebaseWrapper.tsx` |
| หน้า Admin | จัดการผู้ใช้ ดูภาพรวมบิล และดู activity log (เฉพาะ role `admin`) | `app/admin/` |

รายละเอียดการคำนวณผู้ค้างชำระ: [docs/pending-participants.md](docs/pending-participants.md)

---

## สถาปัตยกรรม

```
┌──────────────────────────── Browser ────────────────────────────┐
│ Next.js (React 19)                                              │
│  • Firebase Auth SDK  ── ล็อกอิน / ID token                      │
│  • Firestore SDK      ── อ่าน/เขียน bills, users, groups โดยตรง ─┼──┐
└───────────────┬─────────────────────────────────────────────────┘  │
                │ fetch                                              │
┌───────────────▼──────── Next.js API Routes (Node.js) ───────────┐  │
│ POST /api/share/create   validate (zod) + rate limit → Firestore ┼──┤
│ GET  /api/share/[id]     อ่านลิงก์แชร์ + ตรวจวันหมดอายุ            ┼──┤
│ /api/errors              ปิดใช้งาน (410)                          │  │
└─────────────────────────────────────────────────────────────────┘  │
                                                                     ▼
                                   ┌────────── Cloud Firestore ──────────┐
                                   │ firestore.rules = ด่านตรวจสิทธิ์หลัก  │
                                   └─────────────────────────────────────┘
```

**แนวคิดสำคัญ:** ข้อมูลส่วนใหญ่ถูกอ่านเขียนจาก browser ตรงไปที่ Firestore ดังนั้น **Firestore Security Rules ทำหน้าที่เป็น backend authorization** การซ่อนปุ่มใน UI ไม่ได้ป้องกันอะไร

### Collection ใน Firestore

| Collection | ใครอ่าน/เขียน | หมายเหตุ |
|---|---|---|
| `users/{uid}` | เจ้าของแก้ได้เฉพาะข้อมูลโปรไฟล์ ส่วน `role`/`status` แก้ได้เฉพาะ admin | `isAdmin()` ใน Rules อ่าน `role` จากที่นี่ |
| `bills/{id}` | เฉพาะเจ้าของ (`userId`) หรือ admin | |
| `participantGroups/{id}` | เฉพาะเจ้าของ | |
| `temporary_shared_bills/{shareId}` | สร้างผ่าน API (ไม่ต้องล็อกอิน) อ่านทีละเอกสารด้วย ID ได้ทุกคน **ห้าม list** | `shareId` เป็นค่าสุ่ม 128 บิต |
| `activityLogs/{id}` | ผู้ใช้ที่ล็อกอิน | ใช้ในหน้า Admin |

---

## โมเดลความปลอดภัย

- **Firestore Rules** (`firestore.rules`) ใช้หลักปิดทั้งหมดเป็นค่าเริ่มต้น (deny-by-default) แล้วเปิดเฉพาะที่จำเป็น มีเทสต์ครอบคลุมใน `tests/rules/`
- **ป้องกันการยกระดับสิทธิ์ (privilege escalation):** ผู้ใช้กำหนดหรือแก้ `role`/`status` ของตัวเองไม่ได้ และ `email` ต้องตรงกับ ID token
- **ลิงก์แชร์:** API ตรวจข้อมูลด้วย allowlist (zod) จำกัดขนาด body และความถี่ต่อ IP ส่วน Rules ตรวจโครงสร้างและวันหมดอายุอีกชั้น
- **Secret อยู่ฝั่ง server เท่านั้น:** ไม่มี API key ที่ต้องเป็นความลับใช้ prefix `NEXT_PUBLIC_` ส่วนค่า Firebase web config เปิดเผยได้ตามการออกแบบของ Firebase
- **Security headers:** CSP, HSTS, X-Frame-Options, nosniff ฯลฯ กำหนดใน `next.config.ts` (config มีไฟล์เดียว ห้ามเพิ่ม `next.config.js`)

---

## โครงสร้างโปรเจกต์

```
app/
├── api/                 API Routes (share, chat, errors)
├── components/          UI components (BillSteps, statistics, ui, providers)
├── context/             AuthContext, AuthModalContext, ToastContext
├── hooks/               useBillManagement, useStatistics, useErrorHandler
├── lib/
│   ├── billCalculator.ts   logic คำนวณการหารบิล
│   ├── share/              schema + handler ของลิงก์แชร์
│   ├── firebase.ts         Firebase client SDK
│   └── rateLimit.ts        rate limiter แบบ in-memory
├── share-bill/ bill-history/ bill/[id]/ share/[id]/ statistics/ admin/ ...  หน้าต่าง ๆ
tests/                   Unit tests และ Firestore Rules tests
firestore.rules          Security Rules
.github/workflows/ci.yml CI
```

---

## การติดตั้งและรันในเครื่อง

### สิ่งที่ต้องมี

- Node.js 22 (CI ใช้เวอร์ชันนี้)
- Firebase project ที่เปิด Authentication (Email/Password และ Google) และ Cloud Firestore
- Java 21 ถ้าต้องการรัน Firestore Rules tests (สำหรับ Emulator)

### ขั้นตอน

```bash
npm ci
cp .env.example .env.local   # แล้วใส่ค่า Firebase ของคุณ
npm run dev                  # http://localhost:3000
```

### Environment variables

| ตัวแปร | จำเป็น | คำอธิบาย |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | แนะนำ | จำเป็นสำหรับ Google Sign-in |
| `NEXT_PUBLIC_FIREBASE_APP_ID`, `..._STORAGE_BUCKET`, `..._MESSAGING_SENDER_ID`, `..._MEASUREMENT_ID` | แนะนำ | Firebase web config ส่วนที่เหลือ |
| `NEXT_PUBLIC_APP_URL` | ไม่บังคับ | URL ที่ใช้สร้างลิงก์แชร์ ถ้าไม่ตั้งจะใช้โดเมนที่ผู้ใช้เปิดอยู่ |

ค่า `NEXT_PUBLIC_*` ถูกฝังลงใน JavaScript ตอน build ถ้าไม่ได้ตั้ง `API_KEY` และ `PROJECT_ID` การ build จะยังผ่าน แต่จะขึ้น warning ว่า **build นี้ deploy ไม่ได้**

### คำสั่งที่มี

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | dev server (Turbopack) |
| `npm run build` / `npm start` | build และรัน production |
| `npm run typecheck` | ตรวจ TypeScript (รวมไฟล์เทสต์) |
| `npm run lint` | ESLint |
| `npm test` | unit tests (Vitest) ไม่ต้องใช้ Firebase |
| `npm run test:rules` | Firestore Rules tests บน Emulator (ต้องมี Java) |

---

## การทดสอบ

- **Unit tests** (`npm test`): การคำนวณบิล, API ลิงก์แชร์ (validation, rate limit, วันหมดอายุ) และ Next.js config/security headers
- **Firestore Rules tests** (`npm run test:rules`): รันบน Firestore Emulator ด้วย demo project (`demo-*`) แบบ offline ทั้งหมด **ไม่แตะ Firebase จริง** ครอบคลุมทั้งกรณีที่ต้องอนุญาตและต้องปฏิเสธของ `users` และ `temporary_shared_bills` และมี integration test ที่ส่งข้อมูลจาก API จริงผ่าน Rules
- **ยังไม่มี:** E2E tests ของ flow ล็อกอินและการบันทึกบิลกับ Firebase จริง

## CI

`.github/workflows/ci.yml` รันทุก Pull Request และทุก push เข้า `main`:

1. **Type-check, Lint, Unit tests, Build**
2. **Firestore Rules tests** บน Emulator

ไม่ต้องใช้ secret ใด ๆ ถ้าต้องการให้ CI build ด้วยค่า Firebase จริง ให้ตั้ง **Repository variables** (ไม่ใช่ secrets เพราะค่าเหล่านี้เปิดเผยได้) ชื่อ `NEXT_PUBLIC_FIREBASE_*`

---

## การ Deploy

1. ตั้ง environment variables ที่ hosting (เช่น Vercel)
2. Deploy Security Rules: `firebase deploy --only firestore:rules`
3. ตั้ง **TTL policy** ใน Firebase Console: Firestore → TTL → collection `temporary_shared_bills` → field `expiresAt` เพื่อลบลิงก์แชร์ที่หมดอายุอัตโนมัติ
4. Deploy **composite indexes** จาก `firestore.indexes.json`: `firebase deploy --only firestore:indexes` (`bills`: `userId` + `createdAt desc` สำหรับประวัติบิลและสถิติ, `status` + `paymentDate desc` สำหรับหน้า Admin)
5. ทดสอบบน preview: ล็อกอินด้วย Email และ Google, สร้าง/บันทึกบิล, สร้างและเปิดลิงก์แชร์ พร้อมเปิด DevTools ดูว่ามี CSP violation หรือไม่

---

## ข้อจำกัดที่ทราบ

รายการนี้มาจากการตรวจโค้ดจริง และยังไม่ได้แก้:

| เรื่อง | ผลกระทบ | ตำแหน่ง |
|---|---|---|
| Middleware ตรวจสิทธิ์จาก cookie ที่ตั้งฝั่ง client (ปลอมได้) และ redirect ไป `/login` / `/dashboard` ซึ่งไม่มีหน้าอยู่จริง | ทำหน้าที่ได้แค่ UX ส่วนข้อมูลยังมี Firestore Rules ป้องกันอยู่ | `middleware.ts` |
| การปัดเศษรายคน | ผลรวมอาจไม่ตรงกับยอดบิล เช่น 100 บาทหาร 3 คนได้รวม 99.99 บาท | `app/lib/billCalculator.ts` |
| เมื่อดึงข้อมูลล้มเหลว หน้าประวัติบิลแสดงข้อมูลตัวอย่าง | ผู้ใช้อาจเข้าใจผิดว่าเป็นข้อมูลจริง | `app/bill-history/page.tsx` |
| หน้าสถิติดึงบิลทุกใบโดยไม่จำกัดจำนวน และหน้า Admin ดึงทั้ง collection เพื่อนับ | ช้าลงและค่า Firestore เพิ่มตามจำนวนข้อมูล | `app/hooks/useStatistics.ts`, `app/admin/components/DashboardStats.tsx` |
| API ลิงก์แชร์ใช้ Firebase client SDK แบบไม่ล็อกอิน | ผู้ไม่หวังดีเขียนตรงเข้า Firestore ได้ (ภายใต้ข้อจำกัดของ Rules) โดยเลี่ยง rate limit ของ API | `app/api/share/create/route.ts` |
| Rate limit เก็บในหน่วยความจำ | นับแยกตาม server instance และรีเซ็ตเมื่อ instance ถูกปิด | `app/lib/rateLimit.ts` |
| JavaScript ที่โหลดครั้งแรกค่อนข้างหนัก | หน้าสถิติ 429 kB และหน้าสร้างบิล 360 kB | ผลจาก `npm run build` |
| CSP ยังมี `'unsafe-inline'` และ `'unsafe-eval'` | ลดประสิทธิภาพในการป้องกัน XSS | `next.config.ts` |

## แนวทางพัฒนาต่อ

1. ย้าย API ที่เขียน Firestore ไปใช้ Firebase Admin SDK แล้วปิดการเขียนตรงจาก client ใน Rules
2. ใช้ session cookie ที่ server ออกและตรวจได้ แทน cookie ที่ตั้งฝั่ง client ใน middleware
3. แก้การปัดเศษให้ยอดรวมตรงกับยอดบิลเสมอ
4. ใช้ `getCountFromServer` และจำกัดจำนวนข้อมูลในหน้าสถิติและหน้า Admin
5. โหลดกราฟแบบ lazy (dynamic import) และลดจำนวนฟอนต์
6. เพิ่ม E2E tests ด้วย Firebase Auth/Firestore Emulator
