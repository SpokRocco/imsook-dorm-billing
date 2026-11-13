export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export function getMonthNumber(monthName) {
  const idx = THAI_MONTHS.indexOf((monthName || '').trim());
  return idx >= 0 ? idx + 1 : 11;
}

export function toThaiBahtText(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '';
  const num = Number(amount);
  if (num === 0) return 'ศูนย์บาทถ้วน';
  const isNegative = num < 0;
  const absNum = Math.abs(num).toFixed(2);
  const [intPart, decPart] = absNum.split('.');

  const thaiNums = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const thaiUnits = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

  function convertInteger(str) {
    let res = '';
    const len = str.length;
    for (let i = 0; i < len; i++) {
      const digit = parseInt(str[i], 10);
      const pos = len - i - 1;
      const unitPos = pos % 6;
      if (digit !== 0) {
        if (unitPos === 1 && digit === 1) {
          res += 'สิบ';
        } else if (unitPos === 1 && digit === 2) {
          res += 'ยี่สิบ';
        } else if (unitPos === 0 && digit === 1 && len > 1 && str[i - 1] !== '0') {
          res += 'เอ็ด';
        } else {
          res += thaiNums[digit] + thaiUnits[unitPos];
        }
      }
      if (unitPos === 0 && pos > 0) {
        res += 'ล้าน';
      }
    }
    return res;
  }

  let result = isNegative ? 'ลบ' : '';
  if (parseInt(intPart, 10) > 0) {
    result += convertInteger(intPart) + 'บาท';
  }
  if (parseInt(decPart, 10) === 0) {
    result += 'ถ้วน';
  } else {
    result += convertInteger(decPart) + 'สตางค์';
  }
  return result;
}

export function formatNumber(val) {
  if (val === null || val === undefined || val === '') return '';
  const n = Number(val);
  if (isNaN(n)) return val;
  return n.toLocaleString('en-US');
}

export function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
