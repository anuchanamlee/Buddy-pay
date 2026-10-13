// ที่มาของยอดแต่ละคน (แสดงในหน้าผลลัพธ์) ใช้สูตรเดียวกับ billCalculator:
// VAT คิดจากค่าอาหาร ค่าบริการคิดจากยอดหลัง VAT ส่วนลดแบ่งตามสัดส่วนค่าอาหาร
import type { FoodItem } from './schema';

export interface PersonBreakdown {
  items: { name: string; share: number; sharedWith: number }[];
  food: number;
  vat: number;
  service: number;
  discount: number;
}

export function personBreakdown(
  personId: string,
  foodItems: FoodItem[],
  extras: { vat: number; serviceCharge: number; discount: number },
): PersonBreakdown {
  const items = foodItems
    .filter((item) => item.participants.includes(personId))
    .map((item) => ({ name: item.name, share: item.price / item.participants.length, sharedWith: item.participants.length }));
  const food = items.reduce((sum, i) => sum + i.share, 0);
  const totalFood = foodItems.reduce((sum, i) => sum + (i.participants.length > 0 ? i.price : 0), 0);
  const proportion = totalFood > 0 ? food / totalFood : 0;
  const vat = food * ((extras.vat || 0) / 100);
  const service = (food + vat) * ((extras.serviceCharge || 0) / 100);
  const discount = (extras.discount || 0) * proportion;
  return { items, food, vat, service, discount };
}
