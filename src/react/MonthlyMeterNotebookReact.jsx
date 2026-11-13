import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// เชื่อมต่อฐานข้อมูล Supabase โดยตรงตามสถาปัตยกรรม React + Node.js + Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
export const supabaseClient = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('en-US');
}

export default function MonthlyMeterNotebookReact({ onSyncSuccess }) {
  const [billingMonth, setBillingMonth] = useState('พฤศจิกายน');
  const [billingYearBe, setBillingYearBe] = useState(2569);
  const [zoneFilter, setZoneFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [loading, setLoading] = useState(false);
  const [savingRoom, setSavingRoom] = useState(null);
  const [retroactiveMode, setRetroactiveMode] = useState(false);
  const [globalCorrectionReason, setGlobalCorrectionReason] = useState('แก้ไขตัวเลขมิเตอร์ที่จดคลาดเคลื่อน (Human Error)');

  const [notebookData, setNotebookData] = useState({
    prev_period: { month: 'ตุลาคม', year_be: 2569 },
    next_period: { month: 'ธันวาคม', year_be: 2569 },
    page: 1,
    page_size: 8,
    total_items: 0,
    total_pages: 1,
    summary: {
      total_rooms: 29,
      recorded_count: 0,
      pending_count: 0,
      completion_pct: 0,
      total_projected_revenue: 0,
      total_electric_units: 0,
      total_water_units: 0,
      anomalies: []
    },
    items: [],
    all_rooms_overview: []
  });

  const [toastMsg, setToastMsg] = useState(null);

  const showNotice = (msg, isError = false) => {
    setToastMsg({ msg, isError });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // ดึงข้อมูลแบบแบ่งหน้า (Paginated Fetch) จาก Node.js + Supabase
  const fetchPageData = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        billing_month: billingMonth,
        billing_year_be: String(billingYearBe),
        zone: zoneFilter,
        search: searchQuery,
        page: String(targetPage),
        page_size: String(pageSize)
      });
      const res = await fetch(`/api/meter-notes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotebookData(data);
        setPage(data.page);
      }
    } catch (err) {
      showNotice('ไม่สามารถดึงข้อมูลสมุดจดมิเตอร์ได้: ' + err.message, true);
    } finally {
      setLoading(false);
    }
  }, [billingMonth, billingYearBe, zoneFilter, searchQuery, page, pageSize]);

  useEffect(() => {
    fetchPageData(1);
  }, [billingMonth, billingYearBe, zoneFilter, searchQuery, pageSize]);

  // คำนวณยอดค่าน้ำ ค่าไฟ และรวมสุทธิแบบเรียลไทม์เมื่อกรอกตัวเลขในการ์ดห้อง
  const updateRoomField = (roomNumber, field, value) => {
    setNotebookData((prev) => {
      const updatedItems = prev.items.map((item) => {
        if (item.room_number !== roomNumber) return item;
        const next = { ...item, [field]: value };

        // Recalculate water
        if (next.water_calc_type === 'meter') {
          const wp = parseFloat(next.water_prev);
          const wc = parseFloat(next.water_curr);
          const wUnits = (!isNaN(wp) && !isNaN(wc) && wc >= wp) ? (wc - wp) : 0;
          next.water_units = wUnits;
          next.water_total = wUnits * Number(next.water_unit_price || 10);
        } else if (next.water_calc_type === 'per_person') {
          next.water_units = 0;
          next.water_total = Math.max(1, Number(next.occupant_count || 1)) * 100;
        }

        // Recalculate electric
        const ep = parseFloat(next.electric_prev);
        const ec = parseFloat(next.electric_curr);
        const eUnits = (!isNaN(ep) && !isNaN(ec) && ec >= ep) ? (ec - ep) : 0;
        next.electric_units = eUnits;
        next.electric_total = eUnits * Number(next.electric_unit_price || 8);

        // Recalculate total
        next.total_amount =
          Number(next.room_rate || 0) +
          Number(next.water_total || 0) +
          Number(next.electric_total || 0) +
          Number(next.other_amount || 0) -
          Number(next.deposit_deduction || 0);

        return next;
      });
      return { ...prev, items: updatedItems };
    });
  };

  // บันทึกรายห้อง (สามารถทยอยบันทึกทีละห้อง หรือกลับมาเพิ่มทีหลังได้)
  const saveSingleRoomNote = async (item, syncToInvoice = true) => {
    setSavingRoom(item.room_number);
    try {
      const payload = {
        ...item,
        billing_month: billingMonth,
        billing_year_be: billingYearBe,
        sync_to_invoice: syncToInvoice,
        is_retroactive_correction: retroactiveMode,
        admin_correction_reason: retroactiveMode ? (item.admin_correction_reason || globalCorrectionReason) : ''
      };
      const res = await fetch('/api/meter-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ');
      showNotice(
        retroactiveMode
          ? `✅ แก้ไขย้อนหลัง (Human Error) ห้อง ${item.room_number} และอัปเดตฐานข้อมูลเดือนถัดไปเรียบร้อย!`
          : `✅ บันทึกสมุดจดมิเตอร์ห้อง ${item.room_number} (${item.tenant_name}) ลง Supabase เรียบร้อย!`
      );
      await fetchPageData(page);
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      showNotice(err.message, true);
    } finally {
      setSavingRoom(null);
    }
  };

  // บันทึกทุกห้องในหน้านี้พร้อมกัน
  const saveCurrentPageRooms = async () => {
    setSavingRoom('ALL_PAGE');
    try {
      for (const item of notebookData.items) {
        await fetch('/api/meter-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...item,
            billing_month: billingMonth,
            billing_year_be: billingYearBe,
            sync_to_invoice: true,
            is_retroactive_correction: retroactiveMode,
            admin_correction_reason: retroactiveMode ? (item.admin_correction_reason || globalCorrectionReason) : ''
          })
        });
      }
      showNotice(`💾 บันทึกข้อมูลทั้งหน้านี้ (${notebookData.items.length} ห้อง) ลง Supabase และอัปเดตใบเสร็จเรียบร้อย!`);
      await fetchPageData(page);
      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      showNotice(err.message, true);
    } finally {
      setSavingRoom(null);
    }
  };

  // ส่งต่อเลขมิเตอร์หลังจดของเดือนนี้ ไปตั้งต้นเป็นเลขจดครั้งก่อนของเดือนถัดไปอัตโนมัติ
  const prepareNextMonthFromCurrent = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/meter-notes/prepare-next-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_month: billingMonth,
          from_year_be: billingYearBe
        })
      });
      if (!res.ok) throw new Error('ไม่สามารถเตรียมข้อมูลเดือนถัดไปได้');
      const result = await res.json();
      showNotice(`🚀 วิเคราะห์และส่งต่อเลขมิเตอร์ไปตั้งต้นเดือน ${result.target_month} ${result.target_year_be} (${result.prepared_count} ห้อง) สำเร็จ!`);
      setBillingMonth(result.target_month);
      setBillingYearBe(result.target_year_be);
    } catch (err) {
      showNotice(err.message, true);
    } finally {
      setLoading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'space-y-6' },

    // Toast Alert
    toastMsg &&
      React.createElement(
        'div',
        {
          className: `fixed bottom-6 left-6 z-50 px-5 py-3 rounded-xl shadow-2xl border text-sm font-bold flex items-center gap-2 ${
            toastMsg.isError ? 'bg-rose-600 text-white border-rose-400' : 'bg-slate-900 text-emerald-300 border-emerald-500'
          }`
        },
        React.createElement('span', null, toastMsg.msg)
      ),

    // 1. Top Header & Period Selector + Retroactive Human Error Mode Toggle
    React.createElement(
      'div',
      { className: 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4' },
      React.createElement(
        'div',
        { className: 'flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4' },
        React.createElement(
          'div',
          null,
          React.createElement(
            'div',
            { className: 'flex items-center gap-2' },
            React.createElement(
              'span',
              { className: 'text-xs font-extrabold uppercase tracking-wider bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full border border-sky-200' },
              '⚛️ React + Node.js + Supabase Paginated Module'
            ),
            retroactiveMode &&
              React.createElement(
                'span',
                { className: 'text-xs font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-300 animate-pulse' },
                '🛠️ โหมดแอดมินแก้ไขย้อนหลัง (Human Error Correction)'
              )
          ),
          React.createElement(
            'h2',
            { className: 'text-xl font-bold text-slate-900 mt-1' },
            '📓 โหมดจดบันทึกมิเตอร์รายเดือน (แบ่งหน้าแต่ละห้อง) & แก้ไขย้อนหลังกรณี Human Error'
          ),
          React.createElement(
            'p',
            { className: 'text-sm text-slate-500' },
            'ดึงข้อมูลห้องพักจาก Supabase แสดงผลแบบแบ่งหน้า (Pagination) สามารถทยอยจดบันทึกทีละห้อง กลับมาเพิ่มทีหลัง วิเคราะห์แนวโน้มเพื่อออกบิลเดือนถัดไป และแก้ไขย้อนหลังพร้อมปรับเลขตั้งต้นเดือนถัดไปอัตโนมัติ'
          )
        ),

        // Period Controls
        React.createElement(
          'div',
          { className: 'flex flex-wrap items-center gap-2.5' },
          React.createElement(
            'div',
            { className: 'flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border border-slate-200' },
            React.createElement('span', { className: 'text-xs font-bold text-slate-600' }, 'เดือนที่จด/แก้ไข:'),
            React.createElement(
              'select',
              {
                value: billingMonth,
                onChange: (e) => setBillingMonth(e.target.value),
                className: 'bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-bold text-slate-900'
              },
              THAI_MONTHS.map((m) => React.createElement('option', { key: m, value: m }, m))
            ),
            React.createElement('span', { className: 'text-xs font-bold text-slate-600' }, 'พ.ศ.:'),
            React.createElement(
              'select',
              {
                value: billingYearBe,
                onChange: (e) => setBillingYearBe(Number(e.target.value)),
                className: 'bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-sm font-bold text-slate-900'
              },
              [2568, 2569, 2570].map((y) => React.createElement('option', { key: y, value: y }, y))
            )
          ),

          React.createElement(
            'button',
            {
              onClick: prepareNextMonthFromCurrent,
              disabled: loading,
              className: 'bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow cursor-pointer transition'
            },
            `🚀 ส่งต่อมิเตอร์ไปตั้งต้นเดือนถัดไป (${notebookData.next_period?.month || ''})`
          ),

          React.createElement(
            'button',
            {
              onClick: saveCurrentPageRooms,
              disabled: savingRoom === 'ALL_PAGE',
              className: 'bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow cursor-pointer transition'
            },
            savingRoom === 'ALL_PAGE' ? 'กำลังบันทึก...' : `💾 บันทึกหน้านี้ทั้งหมด (${notebookData.items.length} ห้อง)`
          )
        )
      ),

      // Filter, Pagination Size & Human Error Mode Bar
      React.createElement(
        'div',
        { className: 'flex flex-wrap items-center justify-between gap-3' },
        React.createElement(
          'div',
          { className: 'flex flex-wrap items-center gap-2.5' },
          React.createElement(
            'select',
            {
              value: zoneFilter,
              onChange: (e) => setZoneFilter(e.target.value),
              className: 'border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold bg-white'
            },
            React.createElement('option', { value: '' }, '🏢 ทุกโซนอาคาร (29 ห้อง)'),
            React.createElement('option', { value: 'โซนบ้านพัก 320' }, '🏡 โซนบ้านพัก 320 (8 ห้อง)'),
            React.createElement('option', { value: 'ชั้น 1' }, '1️⃣ ชั้น 1 (7 ห้อง)'),
            React.createElement('option', { value: 'ชั้น 2' }, '2️⃣ ชั้น 2 (14 ห้อง)')
          ),
          React.createElement('input', {
            type: 'text',
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            placeholder: '🔍 ค้นหาเลขห้อง หรือ ชื่อผู้เช่า...',
            className: 'border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white w-52'
          }),
          React.createElement(
            'div',
            { className: 'flex items-center gap-1.5 text-xs text-slate-600' },
            React.createElement('span', { className: 'font-semibold' }, 'แสดงหน้าละ:'),
            React.createElement(
              'select',
              {
                value: pageSize,
                onChange: (e) => setPageSize(Number(e.target.value)),
                className: 'border border-slate-300 rounded-lg px-2 py-1 bg-white font-bold'
              },
              React.createElement('option', { value: 4 }, '4 ห้อง/หน้า'),
              React.createElement('option', { value: 6 }, '6 ห้อง/หน้า'),
              React.createElement('option', { value: 8 }, '8 ห้อง/หน้า'),
              React.createElement('option', { value: 15 }, '15 ห้อง/หน้า'),
              React.createElement('option', { value: 30 }, 'ทั้งหมด 29 ห้อง')
            )
          )
        ),

        // Retroactive Human Error Correction Switch
        React.createElement(
          'div',
          { className: 'flex flex-wrap items-center gap-2' },
          React.createElement(
            'label',
            {
              className: `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer border transition ${
                retroactiveMode
                  ? 'bg-rose-600 text-white border-rose-600 shadow'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`
            },
            React.createElement('input', {
              type: 'checkbox',
              checked: retroactiveMode,
              onChange: (e) => setRetroactiveMode(e.target.checked),
              className: 'rounded'
            }),
            React.createElement('span', null, '🛠️ เปิดโหมดแอดมินแก้ไขย้อนหลัง (Human Error)')
          ),
          retroactiveMode &&
            React.createElement('input', {
              type: 'text',
              value: globalCorrectionReason,
              onChange: (e) => setGlobalCorrectionReason(e.target.value),
              placeholder: 'ระบุสาเหตุการแก้ไขย้อนหลัง...',
              className: 'border border-rose-300 bg-rose-50/40 rounded-xl px-3 py-1.5 text-xs w-64 font-medium text-rose-900'
            })
        )
      )
    ),

    // 2. Analytics & Next-Month Readiness Banner
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4' },
      // Progress Card
      React.createElement(
        'div',
        { className: 'bg-white rounded-2xl p-4 shadow-sm border border-slate-200' },
        React.createElement(
          'div',
          { className: 'flex items-center justify-between text-xs font-bold text-slate-500' },
          React.createElement('span', null, `ความคืบหน้าการจดเดือน ${billingMonth}`),
          React.createElement('span', { className: 'text-emerald-600 font-extrabold' }, `${notebookData.summary.completion_pct}%`)
        ),
        React.createElement(
          'div',
          { className: 'text-2xl font-extrabold text-slate-900 mt-1' },
          `${notebookData.summary.recorded_count} / ${notebookData.summary.total_rooms} ห้อง`
        ),
        React.createElement(
          'div',
          { className: 'w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2' },
          React.createElement('div', {
            className: 'h-full bg-emerald-500 transition-all',
            style: { width: `${notebookData.summary.completion_pct}%` }
          })
        ),
        React.createElement(
          'div',
          { className: 'text-[11px] text-slate-500 mt-1.5' },
          notebookData.summary.pending_count > 0
            ? `ค้างจดอีก ${notebookData.summary.pending_count} ห้อง (กลับมาเพิ่มทีหลังได้)`
            : '✅ จดครบทุกห้องแล้ว พร้อมออกบิลเดือนถัดไป'
        )
      ),

      // Projected Billing Card
      React.createElement(
        'div',
        { className: 'bg-white rounded-2xl p-4 shadow-sm border border-slate-200' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold text-slate-500' },
          'ยอดประมาณการออกบิลรวมทั้งหอพัก'
        ),
        React.createElement(
          'div',
          { className: 'text-2xl font-extrabold text-emerald-600 mt-1' },
          `฿${formatCurrency(notebookData.summary.total_projected_revenue)}`
        ),
        React.createElement(
          'div',
          { className: 'text-[11px] text-slate-500 mt-2 flex justify-between' },
          React.createElement('span', null, `หน่วยไฟรวม: ${notebookData.summary.total_electric_units} หน่วย`),
          React.createElement('span', null, `หน่วยน้ำมิเตอร์: ${notebookData.summary.total_water_units} หน่วย`)
        )
      ),

      // Next Month Analysis Card
      React.createElement(
        'div',
        { className: 'bg-white rounded-2xl p-4 shadow-sm border border-slate-200' },
        React.createElement(
          'div',
          { className: 'text-xs font-bold text-indigo-700' },
          `🔮 การวิเคราะห์เพื่อออกบิลเดือนถัดไป (${notebookData.next_period?.month})`
        ),
        React.createElement(
          'div',
          { className: 'text-sm font-bold text-slate-800 mt-1.5' },
          `เฉลี่ยห้องละ ฿${formatCurrency(Math.round((notebookData.summary.total_projected_revenue || 0) / Math.max(1, notebookData.summary.total_rooms)))}`
        ),
        React.createElement(
          'p',
          { className: 'text-[11px] text-slate-500 mt-1 leading-relaxed' },
          'เลขมิเตอร์ (หลังจด) ของเดือนนี้จะถูกใช้เป็นเลขมิเตอร์ (จดครั้งก่อน) ของเดือนถัดไปโดยอัตโนมัติ'
        )
      ),

      // Human Error & Anomaly Detection Card
      React.createElement(
        'div',
        {
          className: `rounded-2xl p-4 shadow-sm border ${
            (notebookData.summary.anomalies || []).length > 0
              ? 'bg-amber-50 border-amber-300'
              : 'bg-white border-slate-200'
          }`
        },
        React.createElement(
          'div',
          { className: 'text-xs font-bold text-slate-700 flex items-center justify-between' },
          React.createElement('span', null, '🛡️ ระบบตรวจจับความผิดพลาด (Human Error Check)'),
          React.createElement(
            'span',
            { className: 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800' },
            `${(notebookData.summary.anomalies || []).length} จุดสังเกต`
          )
        ),
        (notebookData.summary.anomalies || []).length > 0
          ? React.createElement(
              'div',
              { className: 'mt-1.5 space-y-1 max-h-16 overflow-y-auto text-[11px] text-amber-900' },
              notebookData.summary.anomalies.map((a, idx) =>
                React.createElement(
                  'div',
                  { key: idx, className: 'font-semibold' },
                  `• ห้อง ${a.room_number} (${a.tenant_name}): ${a.issue}`
                )
              )
            )
          : React.createElement(
              'div',
              { className: 'text-xs text-emerald-700 font-semibold mt-2' },
              '✓ เลขมิเตอร์ทุกห้องอยู่ในเกณฑ์ปกติ (หลังจด ≥ ก่อนจด)'
            )
      )
    ),

    // 3. Paginated Room Note Cards Grid
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      notebookData.items.map((item) => {
        const isNegativeElec =
          item.electric_curr !== '' && parseFloat(item.electric_curr) < parseFloat(item.electric_prev);
        const isNegativeWater =
          item.water_calc_type === 'meter' &&
          item.water_curr !== '' &&
          parseFloat(item.water_curr) < parseFloat(item.water_prev);
        const elecDiffFromPrevMonth = Number(item.electric_units || 0) - Number(item.prev_electric_units || 0);

        return React.createElement(
          'div',
          {
            key: item.room_number,
            className: `bg-white rounded-2xl p-5 shadow-sm border-2 transition flex flex-col justify-between space-y-4 ${
              retroactiveMode
                ? 'border-rose-300 bg-rose-50/10'
                : isNegativeElec || isNegativeWater
                ? 'border-amber-400 bg-amber-50/20'
                : item.note_status === 'billed' || item.note_status === 'recorded'
                ? 'border-emerald-200'
                : 'border-slate-200'
            }`
          },
          // Card Top Bar
          React.createElement(
            'div',
            { className: 'space-y-3' },
            React.createElement(
              'div',
              { className: 'flex items-start justify-between gap-2 border-b border-slate-100 pb-3' },
              React.createElement(
                'div',
                { className: 'flex items-center gap-3' },
                React.createElement(
                  'div',
                  { className: 'px-3 py-1.5 rounded-xl bg-slate-900 text-white font-extrabold text-base' },
                  `ห้อง ${item.room_number}`
                ),
                React.createElement(
                  'div',
                  null,
                  React.createElement(
                    'div',
                    { className: 'flex items-center gap-2' },
                    React.createElement('input', {
                      type: 'text',
                      value: item.tenant_name || '',
                      onChange: (e) => updateRoomField(item.room_number, 'tenant_name', e.target.value),
                      placeholder: 'ระบุชื่อผู้เช่า...',
                      className: 'font-bold text-slate-900 text-sm border-b border-dashed border-slate-300 focus:border-indigo-500 outline-none px-1'
                    }),
                    React.createElement(
                      'span',
                      { className: 'text-[11px] text-slate-400 font-medium' },
                      `(${item.zone})`
                    )
                  ),
                  React.createElement(
                    'div',
                    { className: 'text-[11px] text-slate-500 mt-0.5 flex items-center gap-2' },
                    React.createElement('span', null, `ค่าห้อง: ฿${formatCurrency(item.room_rate)}`),
                    item.edit_count > 0 &&
                      React.createElement(
                        'span',
                        { className: 'text-rose-600 font-bold' },
                        `• แก้ไขย้อนหลังแล้ว ${item.edit_count} ครั้ง`
                      )
                  )
                )
              ),

              // Status Badge
              React.createElement(
                'span',
                {
                  className: `px-2.5 py-1 rounded-full text-xs font-bold ${
                    item.note_status === 'billed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : item.note_status === 'recorded'
                      ? 'bg-sky-100 text-sky-800'
                      : 'bg-amber-100 text-amber-800'
                  }`
                },
                item.note_status === 'billed'
                  ? '✓ ออกบิลแล้ว'
                  : item.note_status === 'recorded'
                  ? '✓ จดบันทึกแล้ว'
                  : '⏳ รอจดมิเตอร์ (เพิ่มทีหลังได้)'
              )
            ),

            // Water & Electric Meter Input Boxes
            React.createElement(
              'div',
              { className: 'grid grid-cols-1 sm:grid-cols-2 gap-3' },
              // Water Box
              React.createElement(
                'div',
                { className: 'p-3 rounded-xl bg-sky-50/70 border border-sky-200 space-y-2' },
                React.createElement(
                  'div',
                  { className: 'flex items-center justify-between text-xs font-bold text-sky-900' },
                  React.createElement('span', null, '💧 ค่าน้ำประปา'),
                  React.createElement(
                    'select',
                    {
                      value: item.water_calc_type,
                      onChange: (e) => updateRoomField(item.room_number, 'water_calc_type', e.target.value),
                      className: 'bg-white border border-sky-300 rounded px-1.5 py-0.5 text-[11px]'
                    },
                    React.createElement('option', { value: 'meter' }, 'คิดตามมิเตอร์ (10บ.)'),
                    React.createElement('option', { value: 'per_person' }, 'เหมาตามคน (100บ./คน)'),
                    React.createElement('option', { value: 'flat' }, 'เหมาคงที่')
                  )
                ),

                item.water_calc_type === 'meter'
                  ? React.createElement(
                      'div',
                      { className: 'grid grid-cols-2 gap-2 text-xs' },
                      React.createElement(
                        'div',
                        null,
                        React.createElement('label', { className: 'text-[10px] text-slate-500 block' }, 'จดครั้งก่อน:'),
                        React.createElement('input', {
                          type: 'text',
                          value: item.water_prev || '',
                          onChange: (e) => updateRoomField(item.room_number, 'water_prev', e.target.value),
                          className: 'w-full bg-white border border-sky-300 rounded-lg px-2 py-1 text-center font-mono font-bold'
                        })
                      ),
                      React.createElement(
                        'div',
                        null,
                        React.createElement('label', { className: 'text-[10px] text-sky-800 font-bold block' }, 'หลังจดน้ำ (เดือนนี้):'),
                        React.createElement('input', {
                          type: 'text',
                          value: item.water_curr || '',
                          onChange: (e) => updateRoomField(item.room_number, 'water_curr', e.target.value),
                          placeholder: 'กรอกเลข...',
                          className: 'w-full bg-white border-2 border-sky-500 rounded-lg px-2 py-1 text-center font-mono font-extrabold text-sky-900'
                        })
                      )
                    )
                  : React.createElement(
                      'div',
                      { className: 'flex items-center justify-between text-xs pt-1' },
                      React.createElement('span', { className: 'text-slate-600' }, 'จำนวนผู้เข้าพัก (คนละ 100 บ.):'),
                      React.createElement('input', {
                        type: 'number',
                        min: 1,
                        value: item.occupant_count || 1,
                        onChange: (e) => updateRoomField(item.room_number, 'occupant_count', Number(e.target.value)),
                        className: 'w-16 bg-white border border-sky-300 rounded-lg px-2 py-1 text-center font-bold'
                      })
                    ),

                React.createElement(
                  'div',
                  { className: 'flex items-center justify-between text-xs pt-1 border-t border-sky-200/70' },
                  React.createElement(
                    'span',
                    { className: 'text-[11px] text-sky-800' },
                    item.water_calc_type === 'meter' ? `ใช้น้ำ: ${item.water_units || 0} หน่วย` : 'เหมาจ่ายรายเดือน'
                  ),
                  React.createElement(
                    'span',
                    { className: 'font-extrabold text-sky-700' },
                    `รวมน้ำ: ฿${formatCurrency(item.water_total)}`
                  )
                )
              ),

              // Electric Box
              React.createElement(
                'div',
                { className: 'p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2' },
                React.createElement(
                  'div',
                  { className: 'flex items-center justify-between text-xs font-bold text-amber-900' },
                  React.createElement('span', null, `⚡ ค่าไฟฟ้า (${item.electric_unit_price || 8} บ./หน่วย)`),
                  item.prev_electric_units > 0 &&
                    React.createElement(
                      'span',
                      { className: 'text-[10px] text-slate-500' },
                      `เดือนก่อน: ${item.prev_electric_units} หน่วย`
                    )
                ),

                React.createElement(
                  'div',
                  { className: 'grid grid-cols-2 gap-2 text-xs' },
                  React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'text-[10px] text-slate-500 block' }, 'จดครั้งก่อน:'),
                    React.createElement('input', {
                      type: 'text',
                      value: item.electric_prev || '',
                      onChange: (e) => updateRoomField(item.room_number, 'electric_prev', e.target.value),
                      className: 'w-full bg-white border border-amber-300 rounded-lg px-2 py-1 text-center font-mono font-bold'
                    })
                  ),
                  React.createElement(
                    'div',
                    null,
                    React.createElement('label', { className: 'text-[10px] text-amber-900 font-bold block' }, 'หลังจดไฟ (เดือนนี้):'),
                    React.createElement('input', {
                      type: 'text',
                      value: item.electric_curr || '',
                      onChange: (e) => updateRoomField(item.room_number, 'electric_curr', e.target.value),
                      placeholder: 'กรอกเลข...',
                      className: 'w-full bg-white border-2 border-amber-500 rounded-lg px-2 py-1 text-center font-mono font-extrabold text-amber-950'
                    })
                  )
                ),

                React.createElement(
                  'div',
                  { className: 'flex items-center justify-between text-xs pt-1 border-t border-amber-200/70' },
                  React.createElement(
                    'span',
                    { className: 'text-[11px] text-amber-900 font-semibold' },
                    `ใช้ไฟ: ${item.electric_units || 0} หน่วย`,
                    item.prev_electric_units > 0 &&
                      ` (${elecDiffFromPrevMonth >= 0 ? '+' : ''}${elecDiffFromPrevMonth})`
                  ),
                  React.createElement(
                    'span',
                    { className: 'font-extrabold text-amber-700' },
                    `รวมไฟ: ฿${formatCurrency(item.electric_total)}`
                  )
                )
              )
            ),

            // Warning if Human Error detected on this card
            (isNegativeElec || isNegativeWater) &&
              React.createElement(
                'div',
                { className: 'p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-xs text-rose-800 font-bold' },
                '⚠️ ตรวจพบตัวเลขมิเตอร์หลังจดน้อยกว่าก่อนจด (Human Error) กรุณาตรวจสอบตัวเลขอีกครั้ง'
              ),

            // Other Description / Move-out Deposit Deduction / Note
            React.createElement(
              'div',
              { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs' },
              React.createElement('input', {
                type: 'text',
                value: item.other_description || '',
                onChange: (e) => updateRoomField(item.room_number, 'other_description', e.target.value),
                placeholder: 'ค่าอื่นๆ เช่น หักค่ามัดจำ 2500...',
                className: 'border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white'
              }),
              React.createElement('input', {
                type: 'text',
                value: item.notes || '',
                onChange: (e) => updateRoomField(item.room_number, 'notes', e.target.value),
                placeholder: 'โน้ตช่วยจำประจำห้อง (บันทึกไว้ดูภายหลัง)...',
                className: 'border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white'
              })
            )
          ),

          // Card Footer: Total & Save Action
          React.createElement(
            'div',
            { className: 'pt-3 border-t border-slate-100 flex items-center justify-between gap-2' },
            React.createElement(
              'div',
              null,
              React.createElement('span', { className: 'text-xs text-slate-500' }, 'ยอดสุทธิบิลนี้: '),
              React.createElement(
                'span',
                { className: 'text-lg font-extrabold text-emerald-700' },
                `฿${formatCurrency(item.total_amount)}`
              )
            ),
            React.createElement(
              'div',
              { className: 'flex items-center gap-2' },
              React.createElement(
                'button',
                {
                  onClick: () => saveSingleRoomNote(item, false),
                  disabled: savingRoom === item.room_number,
                  className: 'px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer'
                },
                'พักข้อมูลไว้ทำต่อทีหลัง'
              ),
              React.createElement(
                'button',
                {
                  onClick: () => saveSingleRoomNote(item, true),
                  disabled: savingRoom === item.room_number,
                  className: `px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow cursor-pointer ${
                    retroactiveMode ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`
                },
                savingRoom === item.room_number
                  ? 'กำลังบันทึก...'
                  : retroactiveMode
                  ? '🛠️ บันทึกแก้ไขย้อนหลัง & ซิงค์บิล'
                  : '💾 บันทึก & ซิงค์ออกบิล'
              )
            )
          )
        );
      })
    ),

    // 4. Pagination Controls Bar
    React.createElement(
      'div',
      { className: 'bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4' },
      React.createElement(
        'div',
        { className: 'text-xs font-bold text-slate-600' },
        `กำลังแสดงหน้าที่ ${notebookData.page} จาก ${notebookData.total_pages} หน้า (ทั้งหมด ${notebookData.total_items} ห้อง)`
      ),
      React.createElement(
        'div',
        { className: 'flex items-center gap-1.5' },
        React.createElement(
          'button',
          {
            onClick: () => fetchPageData(Math.max(1, page - 1)),
            disabled: page <= 1 || loading,
            className: 'px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold disabled:opacity-40 cursor-pointer hover:bg-slate-50'
          },
          '← หน้าก่อนหน้า'
        ),
        Array.from({ length: notebookData.total_pages }, (_, idx) => idx + 1).map((pNum) =>
          React.createElement(
            'button',
            {
              key: pNum,
              onClick: () => fetchPageData(pNum),
              className: `w-8 h-8 rounded-lg text-xs font-extrabold cursor-pointer ${
                pNum === page ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`
            },
            pNum
          )
        ),
        React.createElement(
          'button',
          {
            onClick: () => fetchPageData(Math.min(notebookData.total_pages, page + 1)),
            disabled: page >= notebookData.total_pages || loading,
            className: 'px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold disabled:opacity-40 cursor-pointer hover:bg-slate-50'
          },
          'หน้าถัดไป →'
        )
      )
    )
  );
}
