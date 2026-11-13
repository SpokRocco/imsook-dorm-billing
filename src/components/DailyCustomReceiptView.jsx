import React, { useState, useRef } from 'react';
import { Save, Printer, FileDown, Copy } from 'lucide-react';
import ReceiptHalfA4 from './ReceiptHalfA4.jsx';
import { toThaiBahtText } from '../utils/bahtText.js';
import { exportA4ElementsToPdf } from '../utils/pdfGenerator.js';

function createDefaultDoc(type = 'daily', settings = {}) {
  const today = new Date();
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const mName = thaiMonths[today.getMonth()] || 'พฤศจิกายน';
  const yBe = today.getFullYear() + 543;
  return {
    is_blank: false,
    invoice_type: type,
    doc_day: String(today.getDate()),
    tenant_name: '',
    room_number: '',
    zone: '',
    billing_month: mName,
    billing_year_be: yBe,
    days_count: 1,
    daily_rate: 350,
    room_rate: type === 'daily' ? 350 : 2500,
    room_rate_label: type === 'daily' ? 'ค่าเช่าห้องรายวัน 1 วัน' : `ค่าห้องเดือน...${mName}....`,
    water_calc_type: 'meter',
    water_prev: '',
    water_curr: '',
    water_units: 0,
    water_unit_price: settings?.default_water_rate ?? 10,
    water_total: 0,
    electric_prev: '',
    electric_curr: '',
    electric_units: 0,
    electric_unit_price: settings?.default_electric_rate ?? 8,
    electric_total: 0,
    other_description: '',
    other_amount: 0,
    deposit_deduction: 0,
    is_move_out: false,
    total_amount: type === 'daily' ? 350 : 2500,
    baht_text: toThaiBahtText(type === 'daily' ? 350 : 2500)
  };
}

function createBlankDoc() {
  return {
    is_blank: true,
    invoice_type: 'monthly',
    doc_day: '',
    tenant_name: '',
    room_number: '',
    billing_month: '',
    billing_year_be: '',
    room_rate: 0,
    water_total: 0,
    electric_total: 0,
    other_amount: 0,
    total_amount: 0,
    baht_text: ''
  };
}

export default function DailyCustomReceiptView({ rooms = [], settings = {}, onSaved, showToast }) {
  const [topDoc, setTopDoc] = useState(() => createDefaultDoc('daily', settings));
  const [bottomDoc, setBottomDoc] = useState(() => createBlankDoc());
  const [saving, setSaving] = useState(false);
  const sheetRef = useRef(null);

  const setSlot = (slot, doc) => {
    if (slot === 'top') setTopDoc(doc);
    else setBottomDoc(doc);
  };

  const getSlot = (slot) => (slot === 'top' ? topDoc : bottomDoc);

  const onSelectRoom = (slot, roomNumber) => {
    const rm = rooms.find((r) => r.room_number === roomNumber);
    if (!rm) return;
    const prev = getSlot(slot);
    const isDaily = prev.invoice_type === 'daily';
    const rate = isDaily ? Number(rm.daily_rate || 350) : Number(rm.monthly_rate || 2500);
    setSlot(slot, {
      ...prev,
      is_blank: false,
      room_id: rm.id,
      tenant_id: rm.active_tenant?.id || null,
      room_number: rm.room_number,
      zone: rm.zone,
      tenant_name: rm.active_tenant?.name || '',
      room_rate: rate,
      daily_rate: rm.daily_rate || 350,
      water_calc_type: rm.water_calc_type || 'meter',
      water_prev: rm.latest_water_meter || '',
      electric_prev: rm.latest_electric_meter || '',
      water_unit_price: rm.water_rate || 10,
      electric_unit_price: rm.electric_rate || 8,
      room_rate_label: isDaily ? `ค่าเช่าห้องรายวัน ${prev.days_count || 1} วัน` : `ค่าห้องเดือน...${prev.billing_month || ''}....`,
      total_amount: rate,
      baht_text: toThaiBahtText(rate)
    });
  };

  const applyDailyTemplate = (slot) => {
    setSlot(slot, createDefaultDoc('daily', settings));
  };

  const applyMoveOutTemplate = (slot) => {
    const cur = getSlot(slot);
    const nextTotal = Number(cur.room_rate || 2500) + Number(cur.water_total || 0) + Number(cur.electric_total || 0) - 2500;
    setSlot(slot, {
      ...cur,
      is_blank: false,
      invoice_type: 'custom',
      is_move_out: true,
      deposit_deduction: 2500,
      other_description: 'หักค่ามัดจำออก 2,500 บาท (ย้ายออก)',
      total_amount: nextTotal,
      baht_text: toThaiBahtText(nextTotal)
    });
  };

  const handleSave = async () => {
    const toSave = [topDoc, bottomDoc].filter((d) => !d.is_blank && (d.tenant_name || d.room_number || d.total_amount > 0));
    if (!toSave.length) {
      if (showToast) showToast('กรุณากรอกข้อมูลใบเสร็จอย่างน้อย 1 ใบก่อนบันทึก', 'error');
      return;
    }
    setSaving(true);
    try {
      for (const doc of toSave) {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...doc, update_room_meter: false })
        });
        if (!res.ok) throw new Error('บันทึกใบเสร็จไม่สำเร็จ');
      }
      if (showToast) showToast(`บันทึกใบเสร็จและสมการบิล (${toSave.length} ใบ) เรียบร้อย!`);
      if (onSaved) onSaved();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return;
    try {
      await exportA4ElementsToPdf({
        elements: [sheetRef.current],
        filename: `ใบเสร็จรายวัน_กำหนดเอง_${settings?.dorm_name || 'หอพักอิ่มสุข'}.pdf`,
        orientation: 'portrait'
      });
      if (showToast) showToast('ดาวน์โหลดไฟล์ PDF ครึ่ง A4 เรียบร้อย!');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const renderSlotPanel = (slot, label) => {
    const doc = getSlot(slot);
    return (
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-extrabold text-slate-900 text-sm">{label}</span>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSlot(slot, createDefaultDoc(doc.invoice_type || 'daily', settings))}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${!doc.is_blank ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}
            >
              กรอก/แก้ไขเอง
            </button>
            <button
              type="button"
              onClick={() => setSlot(slot, createBlankDoc())}
              className={`px-2.5 py-1 rounded-lg cursor-pointer ${doc.is_blank ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-700'}`}
            >
              ฟอร์มเปล่า (จุดไข่ปลา)
            </button>
          </div>
        </div>

        {!doc.is_blank && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className="font-bold text-slate-600 block mb-1">ดึงข้อมูลห้องพักอัตโนมัติ:</label>
              <select
                onChange={(e) => onSelectRoom(slot, e.target.value)}
                value={doc.room_number || ''}
                className="w-full border border-slate-300 rounded-xl px-2.5 py-2 bg-white font-semibold"
              >
                <option value="">-- พิมพ์เองอิสระ --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.room_number}>ห้อง {r.room_number} ({r.active_tenant?.name || 'ว่าง'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-600 block mb-1">ประเภทการเช่า:</label>
              <select
                value={doc.invoice_type}
                onChange={(e) => setSlot(slot, { ...doc, invoice_type: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-2.5 py-2 bg-white font-semibold"
              >
                <option value="daily">ลูกค้ารายวัน</option>
                <option value="monthly">ลูกค้ารายเดือน</option>
                <option value="custom">กำหนดเอง (หักมัดจำ/ย้ายออก)</option>
              </select>
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => applyMoveOutTemplate(slot)} className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-bold hover:bg-rose-200 cursor-pointer">
                + หักค่ามัดจำ 2,500 บาท (ย้ายออก)
              </button>
              <button type="button" onClick={() => applyDailyTemplate(slot)} className="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-lg font-bold hover:bg-sky-200 cursor-pointer">
                + ตั้งค่าเริ่มต้นรายวัน
              </button>
              {slot === 'bottom' && (
                <button type="button" onClick={() => setBottomDoc({ ...topDoc })} className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold hover:bg-emerald-200 cursor-pointer flex items-center gap-1">
                  <Copy className="w-3 h-3" />
                  <span>คัดลอกใบด้านบนลงล่าง</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="no-print bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              📝 ออกใบเสร็จลูกค้ารายวัน / แก้ไขข้อความอิสระ / ฟอร์มเปล่าครึ่ง A4
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              คลิกแก้ไขตัวเลขและข้อความบนใบเสร็จด้านล่างได้โดยตรงทุกช่อง (2 ใบเสร็จพอดี 1 แผ่น A4)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกลงระบบ Supabase'}</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
            >
              <FileDown className="w-4 h-4" />
              <span>ดาวน์โหลด PDF</span>
            </button>
            <button
              onClick={() => window.print()}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ทันที</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderSlotPanel('top', '🔼 ใบเสร็จครึ่งบน (Top Half-A4)')}
          {renderSlotPanel('bottom', '🔽 ใบเสร็จครึ่งล่าง (Bottom Half-A4)')}
        </div>
      </div>

      {/* Live Editable 2-per-A4 Sheet */}
      <div className="overflow-x-auto pb-6 print-only-container">
        <div ref={sheetRef} className="a4-pdf-pair-sheet">
          <ReceiptHalfA4 doc={topDoc} settings={settings} editable={!topDoc.is_blank} onChange={setTopDoc} />
          <div className="receipt-divider" />
          <ReceiptHalfA4 doc={bottomDoc} settings={settings} editable={!bottomDoc.is_blank} onChange={setBottomDoc} />
        </div>
      </div>
    </div>
  );
}
