// payload แบบที่ ResultStep ส่งจริง: BillState ทั้งก้อน + promptPayId/qrPayload/notes
export function realisticPayload(overrides: Record<string, unknown> = {}) {
  return {
    billName: 'หมูกระทะ',
    totalAmount: 400,
    vat: 0,
    discount: 0,
    serviceCharge: 0,
    splitMethod: 'equal',
    categoryId: 'food',
    foodItems: [{ id: 'f1', name: 'หมู', price: 400, participants: ['p1', 'p2'] }],
    participants: [
      { id: 'p1', name: 'เอ', status: 'pending' },
      { id: 'p2', name: 'บี', status: 'pending' },
    ],
    splitResults: [
      { participant: { id: 'p1', name: 'เอ', status: 'pending' }, amount: 200, items: [{ name: 'ค่าอาหาร', amount: 200 }] },
      { participant: { id: 'p2', name: 'บี', status: 'pending' }, amount: 200, items: [{ name: 'ค่าอาหาร', amount: 200 }] },
    ],
    // ฟิลด์ที่ไม่ควรถูกเก็บในลิงก์แชร์
    bills: [{ id: 'private-bill', name: 'บิลส่วนตัว', userId: 'owner-uid' }],
    participantGroups: [{ id: 'g1', name: 'กลุ่มเพื่อน' }],
    toast: { show: false, message: '', type: 'success' },
    isLoading: false,
    promptPayId: '0812345678',
    qrPayload: '000201010211',
    notes: 'โอนภายในวันนี้',
    ...overrides,
  };
}
