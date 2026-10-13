// Utility functions for statistics calculations and formatting

export const renderSafeAmount = (amount: number): string => {
  if (isNaN(amount) || !isFinite(amount)) return '0';
  return amount.toLocaleString();
};

export const calculatePercentage = (a: number, b: number): number => {
  if (!b || isNaN(b) || !isFinite(b)) return 0;
  return Math.round((a / b) * 100);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const getMonthName = (monthIndex: number): string => {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return months[monthIndex] || 'ไม่ทราบเดือน';
};

export const getMonthAbbr = (monthIndex: number): string => {
  const months = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];
  return months[monthIndex] || 'ไม่ทราบ';
};

export const createLast6MonthsData = () => {
  const today = new Date();
  const monthData = [];
  const monthLookup: Record<string, number> = {};
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setMonth(d.getMonth() - i);
    const monthIndex = d.getMonth();
    const year = d.getFullYear();
    const yearMonth = `${year}-${monthIndex + 1}`;
    
    const index = 5 - i;
    monthData.push({
      name: getMonthAbbr(monthIndex),
      month: getMonthName(monthIndex),
      value: 0,
      yearMonth
    });
    
    monthLookup[yearMonth] = index;
  }
  
  return { monthData, monthLookup };
};

export const validateBillData = (bill: any): boolean => {
  return (
    bill &&
    typeof bill === 'object' &&
    bill.id &&
    bill.title &&
    typeof bill.totalAmount === 'number' &&
    bill.date instanceof Date
  );
};

export const safeNumber = (value: any, defaultValue: number = 0): number => {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};
