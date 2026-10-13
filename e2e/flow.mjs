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
  await p.locator('#item-name').fill('น้ำ'); await p.locator('#item-price').fill('abc'); await p.locator('#item-price').press('Enter');
  ok(await p.locator('#item-price-error').innerText().then((t) => t.includes('ราคา')), 'ราคาไม่ใช่ตัวเลขแสดงข้อความบอกวิธีแก้');
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

await b.close();
console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
