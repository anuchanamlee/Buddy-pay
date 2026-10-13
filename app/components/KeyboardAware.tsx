'use client';

import { useEffect } from 'react';

// มือถือ: พอแตะช่องพิมพ์ คีย์บอร์ดเด้งขึ้นมาบังช่อง (โดยเฉพาะช่องที่อยู่ล่างจอ ใต้แถบยอดรวมที่ติดล่างจอ)
// คอมโพเนนต์นี้ทำ 2 อย่าง
// 1) ตั้ง data-keyboard="open" ที่ <html> ตอนคีย์บอร์ดเปิด เพื่อซ่อนแถบที่ติดล่างจอชั่วคราว (ให้ที่เหลือพอเห็นช่อง)
// 2) เลื่อนหน้าให้ช่องที่กำลังพิมพ์อยู่ในส่วนที่มองเห็นจริง (visualViewport) ไม่ถูก navbar หรือคีย์บอร์ดบัง

const NAVBAR_HEIGHT = 64;
const GAP = 16;
// ความสูงจอที่ลดลงเกินสัดส่วนนี้ถือว่าคีย์บอร์ดเปิด
const KEYBOARD_RATIO = 0.8;

function isTextField(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

export function KeyboardAware() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    // ความสูงจอตอนไม่มีคีย์บอร์ด (อัปเดตเมื่อหมุนจอ)
    let fullHeight = Math.max(window.innerHeight, vv.height);
    let timer: number | undefined;

    const keepVisible = () => {
      const el = document.activeElement;
      if (!isTextField(el)) return;
      // ช่องในหน้าต่างลอย (เช่นหน้าต่างล็อกอิน) เลื่อนหน้าเว็บด้านหลังไม่ช่วยอะไร ปล่อยให้เบราว์เซอร์จัดการ
      if (el.closest('[role="dialog"], [aria-modal="true"]')) return;
      const rect = el.getBoundingClientRect();
      // พิกัดเทียบกับส่วนที่มองเห็นจริง (iOS ไม่หดหน้าเว็บตอนคีย์บอร์ดเปิด หด visualViewport แทน)
      const top = rect.top - vv.offsetTop;
      const bottom = rect.bottom - vv.offsetTop;
      const visibleTop = NAVBAR_HEIGHT + GAP;
      // แถบที่ติดล่างจอ (ยอดรวม) ก็บังได้เหมือนกัน ถ้ายังแสดงอยู่ให้นับขอบบนของแถบเป็นขอบล่าง
      let visibleBottom = vv.height - GAP;
      const footer = document.querySelector<HTMLElement>('[data-sticky-footer]');
      if (footer && footer !== el && !footer.contains(el) && footer.offsetParent !== null) {
        visibleBottom = Math.min(visibleBottom, footer.getBoundingClientRect().top - vv.offsetTop - GAP);
      }
      if (bottom > visibleBottom) {
        window.scrollBy({ top: Math.min(bottom - visibleBottom, top - visibleTop), behavior: 'smooth' });
      } else if (top < visibleTop) {
        window.scrollBy({ top: top - visibleTop, behavior: 'smooth' });
      }
    };

    const update = () => {
      if (!isTextField(document.activeElement)) fullHeight = Math.max(window.innerHeight, vv.height);
      const open = isTextField(document.activeElement) && vv.height < fullHeight * KEYBOARD_RATIO;
      if (open) root.dataset.keyboard = 'open';
      else delete root.dataset.keyboard;
      window.clearTimeout(timer);
      timer = window.setTimeout(keepVisible, 50);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isTextField(e.target as Element)) return;
      // รอคีย์บอร์ดเลื่อนขึ้นเสร็จ (บางเครื่องไม่ยิง resize)
      window.clearTimeout(timer);
      timer = window.setTimeout(update, 300);
    };
    const onFocusOut = () => {
      window.setTimeout(update, 100);
    };

    vv.addEventListener('resize', update);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.clearTimeout(timer);
      vv.removeEventListener('resize', update);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      delete root.dataset.keyboard;
    };
  }, []);

  return null;
}
