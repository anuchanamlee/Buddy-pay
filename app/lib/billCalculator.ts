import { Bill, Participant } from './schema';
import { allocateSatang, fromSatang, toSatang } from './money';

// ประเภทข้อมูลสำหรับผลลัพธ์การคำนวณ
export type SplitResult = {
  participant: Participant;
  amount: number;
  items: { name: string; amount: number }[];
};

/**
 * ฟังก์ชัน memoize สำหรับแคชผลลัพธ์ฟังก์ชันคำนวณที่ซับซ้อน
 */
function memoize<T extends (...args: any[]) => any>(fn: T): T {
  const cache = new Map();
  
  return ((...args: any[]) => {
    // สร้าง key จาก arguments
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // จำกัดขนาดของแคช
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  }) as T;
}

/**
 * คำนวณส่วนแบ่งค่าอาหารตามวิธีการหารที่เลือก
 */
export function calculateSplit(bill: Bill): SplitResult[] {
  // ถ้าเลือกหารเท่ากันหมด
  if (bill.splitMethod === 'equal') {
    return calculateEqualSplit(bill);
  }
  
  // ถ้าเลือกหารตามรายการที่กิน
  return calculateItemizedSplit(bill);
}

/**
 * คำนวณส่วนแบ่งค่าอาหารแบบหารเท่ากันหมด
 * 
 * ตัวอย่างการคำนวณ (ค่าอาหาร 120 บาท, VAT 5%, ค่าบริการ 5%, ส่วนลด 7 บาท):
 * 1. ค่าอาหาร: 120 บาท
 * 2. VAT (5%): 120 × 0.05 = 6 บาท
 * 3. ยอดหลัง VAT: 120 + 6 = 126 บาท
 * 4. ค่าบริการ (5%): 126 × 0.05 = 6.3 บาท
 * 5. ส่วนลด: -7 บาท
 * 6. ยอดสุดท้าย: 126 + 6.3 - 7 = 125.3 บาท
 */
function calculateEqualSplit(bill: Bill): SplitResult[] {
  const totalParticipants = bill.participants.length;
  
  if (totalParticipants === 0) {
    return [];
  }
  
  // คำนวณยอดรวมที่ต้องจ่าย (รวม VAT, ส่วนลด, ค่าบริการ) - แก้ไขการคำนวณ
  const subtotal = bill.foodItems.reduce((sum, item) => sum + item.price, 0);
  const vatAmount = subtotal * (bill.vat / 100);
  const afterVatAmount = subtotal + vatAmount; // ยอดหลัง VAT
  const serviceChargeAmount = afterVatAmount * (bill.serviceCharge / 100); // ค่าบริการคิดจากยอดหลัง VAT
  const finalTotal = afterVatAmount + serviceChargeAmount - bill.discount;
  
  // หารเป็นสตางค์ ให้ยอดทุกคนรวมกันเท่ายอดบิลพอดี เศษสตางค์ไปอยู่กับคนลำดับแรก
  // เช่น 100 บาท หาร 3 = 33.34, 33.33, 33.33
  const shares = allocateSatang(toSatang(Math.max(0, finalTotal)), bill.participants.map(() => 1));
  const per = (value: number) => parseFloat((value / totalParticipants).toFixed(2));

  // สร้างผลลัพธ์สำหรับทุกคน
  return bill.participants.map((participant, index) => {
    const amount = fromSatang(shares[index]);
    return {
      participant,
      amount,
      items: [
        { name: 'ค่าอาหาร', amount: per(subtotal) },
        { name: 'VAT', amount: per(vatAmount) },
        { name: 'ค่าบริการ', amount: per(serviceChargeAmount) },
        { name: 'ส่วนลด', amount: per(-bill.discount) },
        { name: 'ยอดรวมที่ต้องจ่าย', amount }
      ]
    };
  });
}

/**
 * คำนวณส่วนแบ่งค่าอาหารแบบหารตามรายการที่กิน (ปรับปรุงประสิทธิภาพแล้ว)
 * 
 * หลักการคำนวณ:
 * 1. VAT และค่าบริการคิดตามสัดส่วนค่าอาหารที่แต่ละคนกิน
 * 2. ส่วนลดแบ่งตามสัดส่วนค่าอาหารที่แต่ละคนกิน
 * 3. คนที่ไม่กินอะไร = จ่าย 0 บาท
 * 
 * ตัวอย่าง:
 * - คน A กิน 100 บาท (สัดส่วน 100/300 = 33.33%)
 * - คน B กิน 200 บาท (สัดส่วน 200/300 = 66.67%)
 * - คน C ไม่กิน (สัดส่วน 0/300 = 0%)
 * - VAT 5% = 15 บาท, ค่าบริการ 5% = 15.75 บาท, ส่วนลด 30 บาท
 * 
 * ผลลัพธ์:
 * - คน A: 100 + (15×33.33%) + (15.75×33.33%) - (30×33.33%) = 100.25 บาท
 * - คน B: 200 + (15×66.67%) + (15.75×66.67%) - (30×66.67%) = 200.5 บาท  
 * - คน C: 0 บาท
 */
function calculateItemizedSplit(bill: Bill): SplitResult[] {
  // สร้าง Map ของผู้เข้าร่วมเพื่อการเข้าถึงที่รวดเร็ว O(1)
  const participantCosts: Map<string, number> = new Map();
  const participantItems: Map<string, { name: string; amount: number }[]> = new Map();
  
  // สร้าง Map สำหรับทุกคนก่อน - ความซับซ้อน O(n) เมื่อ n คือจำนวนผู้เข้าร่วม
  bill.participants.forEach(p => {
    participantCosts.set(p.id, 0);
    participantItems.set(p.id, []);
  });
  
  // คำนวณยอดรวมค่าอาหารทั้งหมด
  const totalFoodCost = bill.foodItems.reduce((sum, item) => sum + item.price, 0);
  
  // คำนวณส่วนแบ่งค่าอาหารแต่ละรายการ - ความซับซ้อน O(m + p) เมื่อ m คือจำนวนรายการอาหาร
  // และ p คือผลรวมของจำนวนผู้กินในทุกรายการ
  bill.foodItems.forEach(item => {
    const participantCount = item.participants.length;
    if (participantCount === 0) return;
    
    const pricePerPerson = item.price / participantCount;
    
    item.participants.forEach(pId => {
      // ใช้การกระจายค่าเพื่อประสิทธิภาพ
      const currentAmount = participantCosts.get(pId) || 0;
      participantCosts.set(pId, currentAmount + pricePerPerson);
      
      const items = participantItems.get(pId) || [];
      items.push({
        name: item.name,
        amount: parseFloat(pricePerPerson.toFixed(2))
      });
      participantItems.set(pId, items);
    });
  });
  
  // คำนวณ VAT, ค่าบริการ, และส่วนลดตามสัดส่วน
  const vatAmount = totalFoodCost * (bill.vat / 100);
  const afterVatAmount = totalFoodCost + vatAmount;
  const serviceChargeAmount = afterVatAmount * (bill.serviceCharge / 100);
  
  // เพิ่มค่าใช้จ่ายเพิ่มเติมตามสัดส่วน - ความซับซ้อน O(n)
  bill.participants.forEach(p => {
    const participantFoodCost = participantCosts.get(p.id) || 0;
    const items = participantItems.get(p.id) || [];
    
    // คำนวณสัดส่วนของแต่ละคน
    const proportion = totalFoodCost > 0 ? participantFoodCost / totalFoodCost : 0;
    
    // คำนวณค่าใช้จ่ายเพิ่มเติมตามสัดส่วน
    const vatPerPerson = vatAmount * proportion;
    const serviceChargePerPerson = serviceChargeAmount * proportion;
    const discountPerPerson = bill.discount * proportion;
    
    // เพิ่มรายการค่าใช้จ่ายเพิ่มเติม (เฉพาะคนที่มีค่าอาหาร)
    if (participantFoodCost > 0) {
      if (vatPerPerson > 0) {
        items.push({
          name: 'VAT',
          amount: parseFloat(vatPerPerson.toFixed(2))
        });
      }
      
      if (serviceChargePerPerson > 0) {
        items.push({
          name: 'ค่าบริการ',
          amount: parseFloat(serviceChargePerPerson.toFixed(2))
        });
      }
      
      if (discountPerPerson > 0) {
        items.push({
          name: 'ส่วนลด',
          amount: parseFloat((-discountPerPerson).toFixed(2))
        });
      }
    }
    
    // อัปเดตยอดรวมสุดท้าย
    const finalAmount = participantFoodCost + vatPerPerson + serviceChargePerPerson - discountPerPerson;
    participantCosts.set(p.id, finalAmount);
  });
  
  // แบ่งยอดสุดท้ายเป็นสตางค์ตามสัดส่วนที่คำนวณได้ ให้ผลรวมเท่ายอดบิลพอดี
  const exactAmounts = bill.participants.map(p => Math.max(0, participantCosts.get(p.id) || 0));
  const exactTotal = exactAmounts.reduce((a, b) => a + b, 0);
  const shares = allocateSatang(toSatang(exactTotal), exactAmounts);

  return bill.participants.map((p, index) => ({
    participant: p,
    amount: fromSatang(shares[index]),
    items: participantItems.get(p.id) || []
  }));
}

// เพิ่มเวอร์ชัน memoized ของฟังก์ชันคำนวณ
export const calculateSplitMemoized = memoize(calculateSplit);
export const calculateEqualSplitMemoized = memoize(calculateEqualSplit);
export const calculateItemizedSplitMemoized = memoize(calculateItemizedSplit);

/**
 * คำนวณค่าใช้จ่ายทั้งหมด (รวม VAT, ส่วนลด, ค่าบริการ)
 */
function calculateFinalTotal(bill: Bill): number {
  const subtotal = bill.foodItems.reduce((sum, item) => sum + item.price, 0);
  
  // เพิ่ม VAT (ถ้ามี)
  const vatAmount = subtotal * (bill.vat / 100);
  const afterVatAmount = subtotal + vatAmount;
  
  // เพิ่ม ค่าบริการ (คิดจากยอดหลัง VAT)
  const serviceChargeAmount = afterVatAmount * (bill.serviceCharge / 100);
  
  // หัก ส่วนลด (ถ้ามี)
  const discountAmount = bill.discount;
  
  return afterVatAmount + serviceChargeAmount - discountAmount;
}

/**
 * คำนวณค่าใช้จ่ายเพิ่มเติม (VAT, ส่วนลด, ค่าบริการ)
 */
function calculateAdditionalCosts(bill: Bill): number {
  const subtotal = bill.foodItems.reduce((sum, item) => sum + item.price, 0);
  
  // เพิ่ม VAT (ถ้ามี)
  const vatAmount = subtotal * (bill.vat / 100);
  const afterVatAmount = subtotal + vatAmount;
  
  // เพิ่ม ค่าบริการ (คิดจากยอดหลัง VAT)
  const serviceChargeAmount = afterVatAmount * (bill.serviceCharge / 100);
  
  // หัก ส่วนลด (ถ้ามี)
  const discountAmount = bill.discount;
  
  return vatAmount + serviceChargeAmount - discountAmount;
}

// เพิ่มเวอร์ชัน memoized ของฟังก์ชันอื่นๆ
export const calculateFinalTotalMemoized = memoize(calculateFinalTotal);
export const calculateAdditionalCostsMemoized = memoize(calculateAdditionalCosts); 