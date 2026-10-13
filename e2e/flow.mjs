// ทดสอบ flow หารบิลแบบผู้ใช้จริง พร้อมนับจำนวนครั้งที่แตะ/กด
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3100';
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) failures++; };
const slipAmounts = async (p) => (await p.locator('.receipt-slip p.text-\\[1\\.75rem\\]').allInnerTexts()).map((t) => t.replace(/\s*บาท/, '').trim());

async function newPage(w = 390) {
  const ctx = await b.newContext({ viewport: { width: w, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error' && !/firebase|Firestore|identitytoolkit|googleapis|auth\//i.test(m.text())) errors.push(m.text()); });
  await p.goto(`${BASE}/share-bill`, { waitUntil: 'networkidle' });
  return { p, errors, ctx };
}

// 1) กรณีง่าย ใช้คีย์บอร์ดล้วน + นับครั้ง
{
  const { p, errors } = await newPage();
  let taps = 0, keys = 0;
  const type = (t) => p.keyboard.type(t);
  const enter = async () => { keys++; await p.keyboard.press('Enter'); };
  const focused = await p.evaluate(() => document.activeElement?.id);
  ok(focused === 'person-name', 'เปิดหน้าแล้วช่องชื่อพร้อมพิมพ์ทันที (autofocus)');
  for (const n of ['มิ้นท์', 'บอส', 'ฝน']) { await type(n); await enter(); }
  await enter(); // ช่องว่าง → ไปช่องเมนู
  ok(await p.evaluate(() => document.activeElement?.id) === 'item-name', 'Enter ที่ช่องชื่อว่างพาไปช่องเมนู');
  await type('หมูกระทะ'); await enter();
  ok(await p.evaluate(() => document.activeElement?.id) === 'item-price', 'Enter ที่ช่องเมนูพาไปช่องราคา');
  await type('100'); await enter();
  const total = await p.locator('text=ยอดรวม').locator('..').innerText();
  ok(/100\s*บาท/.test(total), 'ยอดรวมล่างจอแสดง 100 บาท');
  taps++; await p.getByRole('button', { name: 'ดูยอดของแต่ละคน' }).click();
  const amounts = await slipAmounts(p);
  ok(JSON.stringify(amounts) === JSON.stringify(['33.34', '33.33', '33.33']), `ยอดต่อคน ${amounts.join(', ')}`);
  ok(/บิล \d+/.test(await p.locator('header input').inputValue()), 'ตั้งชื่อบิลให้อัตโนมัติ');
  taps++; await p.getByPlaceholder('08x-xxx-xxxx').click(); await type('0800000000');
  ok(await p.locator('svg[aria-label^="QR พร้อมเพย์"]').count() === 1, 'ใส่พร้อมเพย์แล้ว QR ขึ้น');
  const saved = await p.evaluate(() => localStorage.getItem('buddypay:promptpay'));
  ok(saved === '0800000000', 'จำเลขพร้อมเพย์ไว้ในเครื่อง');
  taps++; // ส่งเข้า LINE (ไม่กดจริงเพราะต้องใช้ Firebase)
  console.log(`INFO กรณีง่าย: แตะ ${taps} ครั้ง + กด Enter ${keys} ครั้ง = ${taps + keys} (เดิม 18) ไม่รวมพิมพ์พร้อมเพย์ครั้งแรก`);
  

  // รีเฟรชแล้วบิลยังอยู่
  await p.reload({ waitUntil: 'networkidle' });
  ok(JSON.stringify(await slipAmounts(p)) === JSON.stringify(['33.34', '33.33', '33.33']), 'รีเฟรชหน้าผลลัพธ์แล้วบิลไม่หาย');
  // กลับไปแก้แล้วข้อมูลยังอยู่
  await p.getByRole('button', { name: 'แก้ไขบิล' }).click();
  ok(await p.locator('ul[aria-label="รายชื่อคนที่ไป"] li').count() === 3, 'กดแก้ไขบิลแล้วรายชื่อยังอยู่ครบ');
  ok(errors.length === 0, `ไม่มี error ใน console (${errors.join(' | ')})`);
}

// 2) แยกคนกิน + ลบคน + VAT/ค่าบริการ
{
  const { p, errors } = await newPage(1280);
  for (const n of ['เอ', 'บี', 'ซี']) { await p.keyboard.type(n); await p.keyboard.press('Enter'); }
  await p.keyboard.press('Enter');
  await p.keyboard.type('หมู'); await p.keyboard.press('Enter'); await p.keyboard.type('300'); await p.keyboard.press('Enter');
  await p.keyboard.type('เบียร์'); await p.keyboard.press('Enter'); await p.keyboard.type('120'); await p.keyboard.press('Enter');
  ok(await p.locator('text=ทุกคนกิน').count() === 2, 'รายการใหม่เริ่มที่ทุกคนกิน');
  await p.locator('button:has-text("แยกคนกิน")').nth(1).click();
  await p.getByRole('group', { name: 'คนที่กิน เบียร์' }).getByRole('button', { name: 'ซี' }).click();
  ok(await p.locator('text=2 คนกิน: เอ, บี').count() === 1, 'เอาซีออกจากเบียร์แล้วแสดง 2 คนกิน');
  // เพิ่มคนทีหลัง: เข้าหมู (ทุกคนกิน) แต่ไม่เข้าเบียร์
  await p.locator('#person-name').fill('ดี'); await p.locator('#person-name').press('Enter');
  ok(await p.locator('text=2 คนกิน: เอ, บี').count() === 1, 'คนที่เพิ่มทีหลังไม่เข้ารายการที่แยกคนกินไว้');
  await p.locator('summary:has-text("VAT")').click();
  await p.getByLabel('VAT (%)').fill('7'); await p.getByLabel('ค่าบริการ (%)').fill('10'); await p.getByLabel('ส่วนลด (บาท)').fill('20');
  await p.getByLabel('ส่วนลด (บาท)').blur();
  // หมู 300/4 + เบียร์ 120/2; total = (420*1.07)*1.1 - 20 = 474.34
  const footer = await p.locator('text=ยอดรวม').locator('..').innerText();
  ok(/474\.34/.test(footer), `ยอดรวมหลัง VAT ค่าบริการ ส่วนลด = 474.34 (${footer.replace(/\n/g, ' ')})`);
  await p.getByRole('button', { name: 'ดูยอดของแต่ละคน' }).click();
  const amounts = (await slipAmounts(p)).map(Number);
  const sum = Math.round(amounts.reduce((a, c) => a + c, 0) * 100);
  ok(sum === 47434, `ยอดทุกคนรวมกัน = 474.34 (${amounts.join(', ')})`);
  ok(amounts[2] === amounts[3] && amounts[0] === amounts[1] && amounts[0] > amounts[2], 'เอ=บี (กินเบียร์), ซี=ดี (ไม่กินเบียร์)');
  await p.getByRole('button', { name: 'ดูว่ามาจากอะไร' }).first().click();
  ok(await p.locator('dt:has-text("เบียร์")').count() >= 1, 'ดูที่มาของยอดได้');
  // ลบคนที่อยู่ในเบียร์ ยอดรวมต้องคงเดิม
  await p.getByRole('button', { name: 'แก้ไขบิล' }).click();
  await p.getByRole('button', { name: 'เอา บี ออก' }).click();
  const footer2 = await p.locator('text=ยอดรวม').locator('..').innerText();
  ok(/474\.34/.test(footer2), 'ลบคนแล้วยอดรวมไม่หาย');
  
  ok(errors.length === 0, `ไม่มี error ใน console (${errors.join(' | ')})`);
}

// 3) ตรวจข้อผิดพลาดที่ผู้ใช้เจอได้
{
  const { p } = await newPage();
  await p.keyboard.type('คนเดียว'); await p.keyboard.press('Enter');
  ok(await p.getByRole('button', { name: 'ดูยอดของแต่ละคน' }).isDisabled(), 'คนเดียวยังกดดูยอดไม่ได้');
  ok(await p.locator('text=ใส่ชื่อเพื่อนอีก 1 คน').count() === 1, 'บอกว่าขาดอีก 1 คน');
  await p.keyboard.type('คนเดียว'); await p.keyboard.press('Enter');
  ok(await p.locator('ul[aria-label="รายชื่อคนที่ไป"] li').count() === 1, 'ชื่อซ้ำไม่ถูกเพิ่ม');
  await p.locator('#item-name').fill('น้ำ'); await p.locator('#item-price').fill('abc');
  ok(await p.locator('#item-price').inputValue() === '', 'ช่องราคาไม่รับตัวอักษร');
  await p.locator('#item-price').fill('0'); await p.locator('#item-price').press('Enter');
  ok(await p.locator('#item-price-error').innerText().then((t) => t.includes('ราคา')), 'ราคา 0 แสดงข้อความบอกวิธีแก้');
  await p.locator('#item-price').fill('1,250'); await p.locator('#item-price').press('Enter');
  ok(await p.locator('input[id^="price-"]').first().inputValue() === '1250', 'ราคามีจุลภาค "1,250" อ่านได้');
  await p.locator('#person-name').fill('ก, ข, ค'); await p.locator('#person-name').press('Enter');
  ok(await p.locator('ul[aria-label="รายชื่อคนที่ไป"] li').count() === 4, 'พิมพ์หลายชื่อคั่นด้วยจุลภาคได้');
  
}

// 4) หารด่วน
{
  const { p, errors } = await newPage();
  await p.getByRole('tab', { name: 'หารด่วน' }).click();
  await p.keyboard.type('1000');
  await p.getByRole('button', { name: 'เพิ่มจำนวนคน' }).click();
  ok(/333\.33.*333\.34/.test(await p.locator('text=คนละ').locator('..').innerText()), 'หารด่วนแสดงช่วงยอด 333.33–333.34');
  
  await p.getByRole('button', { name: 'ทำ QR ให้เพื่อนสแกนจ่าย' }).click();
  ok(JSON.stringify(await slipAmounts(p)) === JSON.stringify(['333.34', '333.33', '333.33']), 'หารด่วน 1000/3 ได้ 333.34, 333.33, 333.33');
  ok(errors.length === 0, `ไม่มี error ใน console (${errors.join(' | ')})`);
}

// 5) ไม่มีอะไรล้นจอที่ 360px
{
  const { p } = await newPage(360);
  for (const n of ['ชื่อยาวมากๆ คนที่หนึ่ง', 'บอส']) { await p.keyboard.type(n); await p.keyboard.press('Enter'); }
  await p.keyboard.press('Enter'); await p.keyboard.type('ข้าวผัดกระเพราหมูสับไข่ดาวไม่สุกพิเศษ'); await p.keyboard.press('Enter'); await p.keyboard.type('99999.99'); await p.keyboard.press('Enter');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, `หน้าใส่บิลไม่ล้นแนวนอนที่ 360px (${overflow}px)`);
  await p.getByRole('button', { name: 'ดูยอดของแต่ละคน' }).click();
  const overflow2 = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow2 <= 0, `หน้าผลลัพธ์ไม่ล้นแนวนอนที่ 360px (${overflow2}px)`);
}

// 6) มือถือ: คีย์บอร์ดเปิดแล้วต้องยังเห็นช่องที่พิมพ์ (จำลองจอหดเหลือ 420px แบบ Android)
{
  const { p, ctx } = await newPage(390);
  for (const n of ['เอ', 'บี']) { await p.keyboard.type(n); await p.keyboard.press('Enter'); }
  await p.keyboard.press('Enter');
  for (let i = 1; i <= 6; i++) { await p.keyboard.type(`เมนู ${i}`); await p.keyboard.press('Enter'); await p.keyboard.type('50'); await p.keyboard.press('Enter'); }
  // ไม่มีคีย์บอร์ด: ช่องพิมพ์ต้องไม่ถูกแถบยอดรวมบัง
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.locator('#item-name').evaluate((e) => e.focus({ preventScroll: true }));
  await p.waitForTimeout(800);
  const footerTop = (await p.locator('[data-sticky-footer]').boundingBox()).y;
  const b0 = await p.locator('#item-name').boundingBox();
  ok(b0.y + b0.height <= footerTop, `ช่องพิมพ์ไม่ถูกแถบยอดรวมบัง (ช่องล่าง ${Math.round(b0.y + b0.height)} ≤ แถบ ${Math.round(footerTop)})`);
  await p.setViewportSize({ width: 390, height: 420 });
  await p.waitForTimeout(900);
  const box = await p.locator('#item-name').boundingBox();
  ok(box && box.y >= 64 && box.y + box.height <= 420, `คีย์บอร์ดเปิดแล้วยังเห็นช่องพิมพ์ (y=${box && Math.round(box.y)}–${box && Math.round(box.y + box.height)} จากจอสูง 420)`);
  ok(!(await p.locator('[data-sticky-footer]').isVisible()), 'คีย์บอร์ดเปิดแล้วซ่อนแถบยอดรวมชั่วคราว');
  await p.locator('#item-name').blur();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(400);
  ok(await p.locator('[data-sticky-footer]').isVisible(), 'ปิดคีย์บอร์ดแล้วแถบยอดรวมกลับมา');
  await ctx.close();
}

// 7) ช่องตัวเลขพิมพ์ตัวอักษรไม่ได้
{
  const { p, ctx } = await newPage(390);
  await p.locator('#item-price').pressSequentially('abc12.345x');
  ok(await p.locator('#item-price').inputValue() === '12.34', `ช่องราคาเหลือแต่ตัวเลข ("${await p.locator('#item-price').inputValue()}")`);
  await p.locator('#item-price').fill('');
  await p.locator('#item-price').pressSequentially('ห้าสิบ');
  ok(await p.locator('#item-price').inputValue() === '', 'พิมพ์ตัวหนังสือในช่องราคาแล้วไม่ขึ้นอะไร');
  await p.getByRole('tab', { name: 'หารด่วน' }).click();
  await p.keyboard.type('1o0O');
  ok(await p.locator('input[inputmode="decimal"]').first().inputValue() === '10', 'ช่องยอดรวมหารด่วนรับเฉพาะตัวเลข');
  await p.getByRole('button', { name: 'ทำ QR ให้เพื่อนสแกนจ่าย' }).click();
  await p.getByPlaceholder('08x-xxx-xxxx').pressSequentially('08a1-x234');
  ok(await p.getByPlaceholder('08x-xxx-xxxx').inputValue() === '081-234', 'ช่องพร้อมเพย์รับเฉพาะตัวเลขกับขีด');
  await ctx.close();
}

// 8) ปุ่มเปิด/ปิดดูรหัสผ่านในหน้าเข้าสู่ระบบ
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'เข้าสู่ระบบ' }).first().click();
  const pw = p.locator('input[autocomplete="current-password"]');
  await pw.fill('secret123');
  const toggle = p.getByRole('button', { name: 'แสดงรหัสผ่าน' });
  await p.waitForTimeout(500); // รอแอนิเมชันเปิดโมดัลจบ
  const tb = await toggle.boundingBox();
  ok(tb && tb.width >= 44 && tb.height >= 44, `ปุ่มดูรหัสผ่านกดง่าย (${tb && Math.round(tb.width)}x${tb && Math.round(tb.height)})`);
  await toggle.click();
  ok(await pw.getAttribute('type') === 'text' && await pw.inputValue() === 'secret123', 'กดปุ่มตาแล้วเห็นรหัสผ่านและค่าไม่เปลี่ยน');
  ok(await p.getByRole('button', { name: 'ซ่อนรหัสผ่าน' }).getAttribute('aria-pressed') === 'true', 'ปุ่มตาเปลี่ยนเป็น "ซ่อนรหัสผ่าน" (aria-pressed)');
  await p.getByRole('button', { name: 'ซ่อนรหัสผ่าน' }).click();
  ok(await pw.getAttribute('type') === 'password' && await pw.inputValue() === 'secret123', 'กดอีกครั้งแล้วกลับเป็นจุด ค่าไม่เปลี่ยน');
  await ctx.close();
}

// 9) ใช้บนมือถือ: manifest, ทางลัด, หน้าติดตั้ง, ไอคอนหารด่วน, service worker
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const manifest = await (await p.request.get(`${BASE}/manifest.json`)).json();
  ok(manifest.start_url.startsWith('/share-bill') && manifest.display === 'standalone', 'manifest เปิดเต็มจอและเข้าหน้าหารบิล');
  ok(manifest.shortcuts?.map((x) => x.name).join(',') === 'หารด่วน,ใส่บิล,ใครยังค้าง', 'manifest มีทางลัด 3 อัน');
  await p.goto(`${BASE}/share-bill?mode=quick`, { waitUntil: 'networkidle' });
  ok(await p.getByRole('tab', { name: 'หารด่วน' }).getAttribute('aria-selected') === 'true', 'ทางลัด ?mode=quick เปิดหน้าหารด่วน');
  ok(!p.url().includes('mode='), 'ล้าง ?mode ออกจาก URL หลังเปิด');
  ok(await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration('/'))), 'ลงทะเบียน service worker แล้ว');
  await p.goto(`${BASE}/install`, { waitUntil: 'networkidle' });
  ok(await p.getByRole('heading', { name: 'ใช้ BuddyPay บนมือถือ' }).count() === 1, 'หน้า /install เปิดได้');
  await p.goto(`${BASE}/quick`, { waitUntil: 'networkidle' });
  ok(await p.locator('link[rel="manifest"]').getAttribute('href') === '/manifest-quick.json', 'หน้า /quick ใช้ manifest ของไอคอนหารด่วน');
  const cron = await p.request.get(`${BASE}/api/cron/reminders`);
  ok(cron.status() === 503 || cron.status() === 401, `cron แจ้งเตือนไม่ทำงานถ้าไม่ได้ตั้งค่าหรือไม่มีรหัส (${cron.status()})`);
  await ctx.close();
}

await b.close();
console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
