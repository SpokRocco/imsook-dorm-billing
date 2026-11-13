import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FileSpreadsheet, FileDown, Printer, Eye, EyeOff, Sliders, CheckSquare, Square, FileText, Sparkles
} from 'lucide-react';
import ReceiptHalfA4 from './ReceiptHalfA4.jsx';
import { THAI_MONTHS, formatNumber, formatCurrency } from '../utils/bahtText.js';
import { exportA4ElementsToPdf } from '../utils/pdfGenerator.js';

export default function MonthlyReportAndPdfView({
  settings,
  zones = [],
  billingMonth,
  setBillingMonth,
  billingYearBe,
  setBillingYearBe,
  showToast
}) {
  const [subMode, setSubMode] = useState('report'); // 'report' | 'pdf_half_a4'
  const [allRoomsData, setAllRoomsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState('');

  // Full Control Summary Report Options (Point 3.2)
  const [zoneFilter, setZoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'recorded' | 'unrecorded'
  const [sortBy, setSortBy] = useState('sort_order'); // 'sort_order' | 'total_desc'
  const [orientation, setOrientation] = useState('portrait'); // 'portrait' | 'landscape'
  const [density, setDensity] = useState('normal'); // 'compact' | 'normal' | 'large'
  const [reportTitle, setReportTitle] = useState('รายงานสรุปรายการค่าเช่าห้องพักและสาธารณูปโภคประจำเดือน');
  const [reportSubtitle, setReportSubtitle] = useState('เอกสารสรุปข้อมูลรายเดือนจากฐานข้อมูลกลาง Supabase');
  const [footerNote, setFooterNote] = useState('ตรวจสอบยอดค่าน้ำ ค่าไฟฟ้า และค่าเช่าห้องพักครบถ้วนถูกต้องตามสมการคำนวณ');
  const [showBankFooter, setShowBankFooter] = useState(true);

  const [columns, setColumns] = useState({
    seq: true,
    zone: true,
    room_number: true,
    tenant_name: true,
    room_rate: true,
    water_usage: true, // เลขหน่วยค่าน้ำ หรือ ค่าน้ำเหมาจ่าย
    water_total: true,
    electric_usage: true, // เลขหน่วยค่าไฟ
    electric_total: true,
    other_amount: true,
    total_amount: true,
    status: false,
    formula: false
  });

  // PDF Half-A4 Selection State (Point 3.3 - strictly on PDF!)
  const [selectedPdfRooms, setSelectedPdfRooms] = useState([]);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);

  const reportSheetsRef = useRef([]);
  const pdfPairSheetsRef = useRef([]);

  const fetchMonthlyAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        billing_month: billingMonth,
        billing_year_be: String(billingYearBe),
        page: '1',
        page_size: '200'
      });
      const res = await fetch(`/api/meter-notes?${params.toString()}`);
      if (!res.ok) throw new Error('โหลดข้อมูลรายเดือนไม่สำเร็จ');
      const data = await res.json();
      const list = data.all_rooms_items || data.items || [];
      setAllRoomsData(list);
      // Default pick all recorded rooms (or all rooms if none recorded) for Half-A4 PDF
      const recordedNums = list.filter((i) => i.is_recorded).map((i) => i.room_number);
      setSelectedPdfRooms(recordedNums.length > 0 ? recordedNums : list.map((i) => i.room_number));
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [billingMonth, billingYearBe]);

  useEffect(() => {
    fetchMonthlyAll();
  }, [fetchMonthlyAll]);

  const filteredReportRows = useMemo(() => {
    let list = allRoomsData.filter((item) => {
      if (zoneFilter && item.zone !== zoneFilter) return false;
      if (statusFilter === 'recorded' && !item.is_recorded) return false;
      if (statusFilter === 'unrecorded' && item.is_recorded) return false;
      return true;
    });
    if (sortBy === 'total_desc') {
      list = [...list].sort((a, b) => Number(b.total_amount || 0) - Number(a.total_amount || 0));
    }
    return list;
  }, [allRoomsData, zoneFilter, statusFilter, sortBy]);

  // Paginate Report Rows across A4 sheets cleanly
  const rowsPerPage = orientation === 'landscape'
    ? (density === 'compact' ? 22 : density === 'normal' ? 18 : 14)
    : (density === 'compact' ? 32 : density === 'normal' ? 24 : 18);

  const reportPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < filteredReportRows.length; i += rowsPerPage) {
      pages.push(filteredReportRows.slice(i, i + rowsPerPage));
    }
    return pages.length > 0 ? pages : [[]];
  }, [filteredReportRows, rowsPerPage]);

  // Totals for Report
  const reportTotals = useMemo(() => {
    return filteredReportRows.reduce(
      (acc, r) => {
        acc.room_rate += Number(r.room_rate || 0);
        acc.water_units += Number(r.water_units || 0);
        acc.water_total += Number(r.water_total || 0);
        acc.electric_units += Number(r.electric_units || 0);
        acc.electric_total += Number(r.electric_total || 0);
        acc.other_signed += Number(r.other_amount || 0) - Number(r.deposit_deduction || 0);
        acc.total_amount += Number(r.total_amount || 0);
        return acc;
      },
      { room_rate: 0, water_units: 0, water_total: 0, electric_units: 0, electric_total: 0, other_signed: 0, total_amount: 0 }
    );
  }, [filteredReportRows]);

  // Pairs for PDF-only Half-A4 (Strictly 2 rooms per A4 sheet!)
  const pdfRoomsList = useMemo(() => {
    const setNums = new Set(selectedPdfRooms);
    return allRoomsData.filter((i) => setNums.has(i.room_number));
  }, [allRoomsData, selectedPdfRooms]);

  const pdfPairs = useMemo(() => {
    const pairs = [];
    for (let i = 0; i < pdfRoomsList.length; i += 2) {
      pairs.push([pdfRoomsList[i], pdfRoomsList[i + 1] || null]);
    }
    return pairs;
  }, [pdfRoomsList]);

  const toggleColumn = (key) => {
    setColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePdfRoom = (roomNum) => {
    setSelectedPdfRooms((prev) =>
      prev.includes(roomNum) ? prev.filter((r) => r !== roomNum) : [...prev, roomNum]
    );
  };

  const handleDownloadSummaryReportPdf = async () => {
    const validEls = reportSheetsRef.current.filter(Boolean);
    if (!validEls.length) return;
    setExportingPdf(true);
    try {
      await exportA4ElementsToPdf({
        elements: validEls,
        filename: `รายงานสรุปรายเดือน_${settings?.dorm_name || 'หอพักอิ่มสุข'}_${billingMonth}_${billingYearBe}.pdf`,
        orientation,
        onProgress: (cur, tot) => setPdfProgress(`กำลังสร้าง PDF หน้า ${cur}/${tot}`)
      });
      if (showToast) showToast('ดาวน์โหลดไฟล์ PDF รายงานสรุปรายเดือนเรียบร้อย!');
    } catch (err) {
      if (showToast) showToast('ไม่สามารถสร้าง PDF: ' + err.message, 'error');
    } finally {
      setExportingPdf(false);
      setPdfProgress('');
    }
  };

  const handleDownloadHalfA4ReceiptsPdf = async () => {
    if (!pdfPairs.length) {
      if (showToast) showToast('กรุณาเลือกห้องพักอย่างน้อย 1 ห้อง', 'error');
      return;
    }
    setExportingPdf(true);
    try {
      // Wait next animation frame so hidden/staged capture DOM mounts cleanly
      await new Promise((r) => setTimeout(r, 120));
      const validEls = pdfPairSheetsRef.current.filter(Boolean);
      await exportA4ElementsToPdf({
        elements: validEls,
        filename: `ใบเสร็จครึ่งA4_${settings?.dorm_name || 'หอพักอิ่มสุข'}_${billingMonth}_${billingYearBe}_(${pdfRoomsList.length}ห้อง).pdf`,
        orientation: 'portrait',
        onProgress: (cur, tot) => setPdfProgress(`กำลังจัดหน้า PDF 2 ห้อง/แผ่น (${cur}/${tot})`)
      });
      if (showToast) {
        showToast(`ดาวน์โหลด PDF ใบเสร็จ ${pdfRoomsList.length} ห้อง (${pdfPairs.length} แผ่น A4) เรียบร้อย!`);
      }
    } catch (err) {
      if (showToast) showToast('เกิดข้อผิดพลาดในการสร้าง PDF: ' + err.message, 'error');
    } finally {
      setExportingPdf(false);
      setPdfProgress('');
    }
  };

  const dormName = settings?.dorm_name || 'หอพักอิ่มสุข';

  const columnDefs = [
    { key: 'seq', label: 'ลำดับ' },
    { key: 'zone', label: 'โซน' },
    { key: 'room_number', label: 'หมายเลขห้อง' },
    { key: 'tenant_name', label: 'ชื่อผู้ใช้ / ผู้เช่า' },
    { key: 'room_rate', label: 'ค่าเช่าห้อง' },
    { key: 'water_usage', label: 'หน่วยน้ำ / เหมาจ่าย' },
    { key: 'water_total', label: 'ค่าน้ำ (บาท)' },
    { key: 'electric_usage', label: 'เลขหน่วยค่าไฟ' },
    { key: 'electric_total', label: 'ค่าไฟ (บาท)' },
    { key: 'other_amount', label: 'อื่นๆ (+/-)' },
    { key: 'total_amount', label: 'ค่าใช้จ่ายรวม' },
    { key: 'status', label: 'สถานะบันทึก' },
    { key: 'formula', label: 'สมการคำนวณ' }
  ];

  const densityClass = density === 'compact'
    ? 'text-[10.5px] py-1 px-1.5'
    : density === 'large'
      ? 'text-[13px] py-2 px-2.5'
      : 'text-[11.5px] py-1.5 px-2';

  return (
    <div className="space-y-5">
      {/* Top Mode & Period Control Bar (.no-print) */}
      <div className="no-print bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{dormName} • A4 Report &amp; PDF Studio</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              รีพอร์ตสรุปรายเดือน (A4 Full Control) &amp; ใบเสร็จครึ่ง A4 บนไฟล์ PDF
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold bg-white min-h-[42px]"
            >
              {THAI_MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={billingYearBe}
              onChange={(e) => setBillingYearBe(Number(e.target.value))}
              className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold bg-white min-h-[42px]"
            >
              {[2568, 2569, 2570, 2571].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Sub-mode switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setSubMode('report')}
                className={`px-3.5 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition ${
                  subMode === 'report' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>รีพอร์ตสรุป A4 (Full Control)</span>
              </button>
              <button
                onClick={() => setSubMode('pdf_half_a4')}
                className={`px-3.5 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition ${
                  subMode === 'pdf_half_a4' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>PDF บิลครึ่ง A4 (2 ห้อง/แผ่น)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= SUB-MODE A: FULL-CONTROL A4 REPORT ================= */}
      {subMode === 'report' && (
        <div className="space-y-5">
          {/* Full Control Customization Box */}
          <div className="no-print bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 font-extrabold text-slate-900 text-sm">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>แผงควบคุมการแสดงผลบนกระดาษ A4 (Full Control)</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์เอกสาร A4</span>
                </button>
                <button
                  onClick={handleDownloadSummaryReportPdf}
                  disabled={exportingPdf}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <FileDown className="w-4 h-4" />
                  <span>{exportingPdf ? pdfProgress || 'กำลังสร้าง PDF...' : 'ดาวน์โหลดไฟล์ PDF (A4)'}</span>
                </button>
              </div>
            </div>

            {/* Filters & Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">กรองโซน</label>
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-2.5 py-2 bg-white font-semibold"
                >
                  <option value="">ทุกโซนทั้งหมด ({allRoomsData.length} ห้อง)</option>
                  {zones.map((z) => (
                    <option key={z.name} value={z.name}>{z.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">กรองสถานะการบันทึก</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-2.5 py-2 bg-white font-semibold"
                >
                  <option value="all">แสดงทุกห้อง ({allRoomsData.length})</option>
                  <option value="recorded">เฉพาะบันทึกแล้ว</option>
                  <option value="unrecorded">เฉพาะยังไม่บันทึก</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">การเรียงลำดับ</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-2.5 py-2 bg-white font-semibold"
                >
                  <option value="sort_order">ตามลำดับห้องพัก</option>
                  <option value="total_desc">ตามค่าใช้จ่ายรวม (มาก→น้อย)</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">แนวกระดาษ A4</label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-2.5 py-2 bg-white font-semibold"
                >
                  <option value="portrait">A4 แนวตั้ง (Portrait)</option>
                  <option value="landscape">A4 แนวนอน (Landscape)</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">ขนาดตัวอักษร/ความแน่น</label>
                <select
                  value={density}
                  onChange={(e) => setDensity(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-2.5 py-2 bg-white font-semibold"
                >
                  <option value="compact">กะทัดรัด (ใส่ได้สูงสุด 32 แถว/หน้า)</option>
                  <option value="normal">มาตรฐาน (แนะนำ 24 แถว/หน้า)</option>
                  <option value="large">ตัวอักษรใหญ่พิเศษ (18 แถว/หน้า)</option>
                </select>
              </div>
            </div>

            {/* Editable Title / Subtitle / Note */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 block mb-1">หัวข้อหลักเอกสาร</label>
                <input
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">คำอธิบายรอง</label>
                <input
                  value={reportSubtitle}
                  onChange={(e) => setReportSubtitle(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 block mb-1">หมายเหตุท้ายรายงาน</label>
                <input
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2"
                />
              </div>
            </div>

            {/* Column Visibility Checkboxes */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-extrabold text-slate-700">เลือกคอลัมน์ที่ต้องการแสดงบน A4:</span>
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBankFooter}
                    onChange={(e) => setShowBankFooter(e.target.checked)}
                    className="accent-emerald-600"
                  />
                  <span>แสดงข้อมูลบัญชีรับโอนท้ายกระดาษ</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {columnDefs.map((col) => {
                  const active = Boolean(columns[col.key]);
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => toggleColumn(col.key)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer flex items-center gap-1 transition ${
                        active
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      {active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>{col.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Paginated A4 Sheets Container (Horizontal Scroll on Narrow Phones) */}
          <div className="overflow-x-auto pb-4 print-only-container">
            {reportPages.map((pageRows, pageIdx) => {
              const startIdx = pageIdx * rowsPerPage;
              const isLastPage = pageIdx === reportPages.length - 1;
              return (
                <div
                  key={pageIdx}
                  ref={(el) => {
                    reportSheetsRef.current[pageIdx] = el;
                  }}
                  className={`${orientation === 'landscape' ? 'a4-sheet-landscape' : 'a4-sheet'} p-7`}
                >
                  <div className="space-y-3">
                    {/* Sheet Header */}
                    <div className="border-b-2 border-slate-900 pb-2.5 flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider">
                          {dormName} • MONTHLY SUMMARY REPORT (A4)
                        </div>
                        <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">{reportTitle}</h1>
                        <p className="text-xs text-slate-600">{reportSubtitle}</p>
                      </div>
                      <div className="text-right shrink-0 border border-slate-300 rounded-xl px-3.5 py-2 bg-slate-50">
                        <div className="text-[11px] font-bold text-slate-500">ประจำเดือน</div>
                        <div className="text-base font-extrabold text-slate-900">{billingMonth} พ.ศ. {billingYearBe}</div>
                        <div className="text-[10px] text-slate-500">
                          หน้า {pageIdx + 1}/{reportPages.length} • {filteredReportRows.length} ห้อง {zoneFilter ? `(${zoneFilter})` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Full Control Table */}
                    <table className="w-full border-collapse border border-slate-400 text-slate-900">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          {columns.seq && <th className={`border border-slate-700 text-center ${densityClass}`}>#</th>}
                          {columns.zone && <th className={`border border-slate-700 text-left ${densityClass}`}>โซน</th>}
                          {columns.room_number && <th className={`border border-slate-700 text-center ${densityClass}`}>ห้อง</th>}
                          {columns.tenant_name && <th className={`border border-slate-700 text-left ${densityClass}`}>ชื่อผู้ใช้ / ผู้เช่า</th>}
                          {columns.room_rate && <th className={`border border-slate-700 text-right ${densityClass}`}>ค่าห้อง</th>}
                          {columns.water_usage && <th className={`border border-slate-700 text-center ${densityClass}`}>หน่วยน้ำ / เหมาจ่าย</th>}
                          {columns.water_total && <th className={`border border-slate-700 text-right ${densityClass}`}>ค่าน้ำ (บ.)</th>}
                          {columns.electric_usage && <th className={`border border-slate-700 text-center ${densityClass}`}>หน่วยไฟ</th>}
                          {columns.electric_total && <th className={`border border-slate-700 text-right ${densityClass}`}>ค่าไฟ (บ.)</th>}
                          {columns.other_amount && <th className={`border border-slate-700 text-right ${densityClass}`}>อื่นๆ (+/-)</th>}
                          {columns.total_amount && <th className={`border border-slate-700 text-right ${densityClass}`}>ค่าใช้จ่ายรวม</th>}
                          {columns.status && <th className={`border border-slate-700 text-center ${densityClass}`}>สถานะ</th>}
                          {columns.formula && <th className={`border border-slate-700 text-left ${densityClass}`}>สมการคำนวณ</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((row, rIdx) => {
                          const netOther = Number(row.other_amount || 0) - Number(row.deposit_deduction || 0);
                          return (
                            <tr key={row.room_number} className={rIdx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}>
                              {columns.seq && <td className={`border border-slate-300 text-center ${densityClass}`}>{startIdx + rIdx + 1}</td>}
                              {columns.zone && <td className={`border border-slate-300 text-left whitespace-nowrap ${densityClass}`}>{row.zone}</td>}
                              {columns.room_number && <td className={`border border-slate-300 text-center font-extrabold ${densityClass}`}>{row.room_number}</td>}
                              {columns.tenant_name && <td className={`border border-slate-300 text-left font-medium ${densityClass}`}>{row.tenant_name || '-'}</td>}
                              {columns.room_rate && <td className={`border border-slate-300 text-right ${densityClass}`}>{formatCurrency(row.room_rate)}</td>}
                              {columns.water_usage && (
                                <td className={`border border-slate-300 text-center ${densityClass}`}>
                                  {row.water_calc_type === 'meter'
                                    ? `${row.water_units || 0} หน่วย (${row.water_prev || '-'}→${row.water_curr || '-'})`
                                    : `เหมาจ่าย (${formatCurrency(row.water_total)} บ.)`}
                                </td>
                              )}
                              {columns.water_total && <td className={`border border-slate-300 text-right ${densityClass}`}>{formatCurrency(row.water_total)}</td>}
                              {columns.electric_usage && (
                                <td className={`border border-slate-300 text-center ${densityClass}`}>
                                  {row.electric_units || 0} หน่วย ({row.electric_prev || '-'}→{row.electric_curr || '-'})
                                </td>
                              )}
                              {columns.electric_total && <td className={`border border-slate-300 text-right ${densityClass}`}>{formatCurrency(row.electric_total)}</td>}
                              {columns.other_amount && (
                                <td className={`border border-slate-300 text-right ${densityClass} ${netOther < 0 ? 'text-rose-700' : ''}`}>
                                  {netOther !== 0 ? (netOther > 0 ? `+${formatCurrency(netOther)}` : formatCurrency(netOther)) : '-'}
                                </td>
                              )}
                              {columns.total_amount && (
                                <td className={`border border-slate-300 text-right font-extrabold text-emerald-800 ${densityClass}`}>
                                  {formatCurrency(row.total_amount)}
                                </td>
                              )}
                              {columns.status && (
                                <td className={`border border-slate-300 text-center font-bold ${densityClass}`}>
                                  {row.is_recorded ? '✓ บันทึกแล้ว' : 'ยังไม่บันทึก'}
                                </td>
                              )}
                              {columns.formula && (
                                <td className={`border border-slate-300 font-mono text-[10px] ${densityClass}`}>
                                  {row.formula_expression}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {pageRows.length === 0 && (
                          <tr>
                            <td colSpan={13} className="py-8 text-center text-slate-400 text-sm">
                              ไม่มีข้อมูลตามตัวกรองที่เลือก
                            </td>
                          </tr>
                        )}
                      </tbody>

                      {isLastPage && filteredReportRows.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-100 font-extrabold border-t-2 border-slate-900">
                            {columns.seq && <td className={`border border-slate-300 text-center ${densityClass}`}>รวม</td>}
                            {columns.zone && <td className={`border border-slate-300 ${densityClass}`}>{filteredReportRows.length} ห้อง</td>}
                            {columns.room_number && <td className={`border border-slate-300 ${densityClass}`} />}
                            {columns.tenant_name && <td className={`border border-slate-300 text-right ${densityClass}`}>ยอดรวมสุทธิทั้งหมด:</td>}
                            {columns.room_rate && <td className={`border border-slate-300 text-right ${densityClass}`}>{formatCurrency(reportTotals.room_rate)}</td>}
                            {columns.water_usage && <td className={`border border-slate-300 text-center ${densityClass}`}>{formatCurrency(reportTotals.water_units)} หน่วย+เหมา</td>}
                            {columns.water_total && <td className={`border border-slate-300 text-right ${densityClass}`}>{formatCurrency(reportTotals.water_total)}</td>}
                            {columns.electric_usage && <td className={`border border-slate-300 text-center ${densityClass}`}>{formatCurrency(reportTotals.electric_units)} หน่วย</td>}
                            {columns.electric_total && <td className={`border border-slate-300 text-right ${densityClass}`}>{formatCurrency(reportTotals.electric_total)}</td>}
                            {columns.other_amount && <td className={`border border-slate-300 text-right ${densityClass}`}>{formatCurrency(reportTotals.other_signed)}</td>}
                            {columns.total_amount && <td className={`border border-slate-300 text-right text-emerald-800 ${densityClass}`}>{formatCurrency(reportTotals.total_amount)} บ.</td>}
                            {columns.status && <td className={`border border-slate-300 ${densityClass}`} />}
                            {columns.formula && <td className={`border border-slate-300 ${densityClass}`} />}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Sheet Sign-off Footer */}
                  <div className="pt-3 border-t border-slate-300 flex flex-wrap items-end justify-between gap-4 text-[11px] text-slate-600 mt-4">
                    <div>
                      <div className="font-bold text-slate-800">หมายเหตุ: {footerNote}</div>
                      {showBankFooter && (
                        <div>
                          บัญชีรับโอน: {settings?.bank_name} {settings?.account_number} ({settings?.account_holder})
                        </div>
                      )}
                    </div>
                    <div className="flex gap-8 text-center">
                      <div>
                        <div className="w-32 border-b border-dotted border-slate-500 mb-1">&nbsp;</div>
                        <div>ผู้จัดทำ / แอดมิน</div>
                      </div>
                      <div>
                        <div className="w-32 border-b border-dotted border-slate-500 mb-1">&nbsp;</div>
                        <div>({settings?.account_holder || 'นาง เอมอร ไทยนอ'})</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= SUB-MODE B: HALF-A4 PDF ONLY (2 ROOMS / PAGE) ================= */}
      {subMode === 'pdf_half_a4' && (
        <div className="space-y-5">
          <div className="no-print bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  📑 ส่งออกบิลรายเดือนขนาดครึ่ง A4 (จัดวางพอดี 2 ห้องต่อกระดาษ A4 1 แผ่นบนไฟล์ PDF เท่านั้น)
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  หน้าเว็บแสดงรายการเลือกห้องแบบกะทัดรัด ส่วนใบเสร็จครึ่ง A4 (บน + ล่าง) จะจัดหน้า 2 ห้องต่อแผ่นพอดีเมื่อดาวน์โหลดหรือดู PDF
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPdfPreviewModal((v) => !v)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-4 h-4" />
                  <span>{showPdfPreviewModal ? 'ซ่อนตัวอย่างหน้า PDF' : `ดูตัวอย่างจัดหน้า (${pdfPairs.length} แผ่น)`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>สั่งพิมพ์ PDF</span>
                </button>
                <button
                  type="button"
                  disabled={exportingPdf || !pdfPairs.length}
                  onClick={handleDownloadHalfA4ReceiptsPdf}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <FileDown className="w-4 h-4" />
                  <span>
                    {exportingPdf
                      ? pdfProgress || 'กำลังสร้างไฟล์ PDF...'
                      : `ดาวน์โหลด PDF (${pdfRoomsList.length} ห้อง = ${pdfPairs.length} แผ่น A4)`}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Room Pick Controls */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-extrabold text-slate-700">
                  เลือกห้องพักสำหรับพิมพ์ลง PDF ({selectedPdfRooms.length}/{allRoomsData.length} ห้อง • {pdfPairs.length} แผ่น A4):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedPdfRooms(allRoomsData.map((i) => i.room_number))}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    เลือกทั้งหมด
                  </button>
                  <button
                    onClick={() => setSelectedPdfRooms(allRoomsData.filter((i) => i.is_recorded).map((i) => i.room_number))}
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 cursor-pointer"
                  >
                    เฉพาะที่บันทึกแล้ว ({allRoomsData.filter((i) => i.is_recorded).length})
                  </button>
                  {zones.map((z) => (
                    <button
                      key={z.name}
                      onClick={() => setSelectedPdfRooms(allRoomsData.filter((i) => i.zone === z.name).map((i) => i.room_number))}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-bold hover:bg-indigo-100 cursor-pointer"
                    >
                      เฉพาะ {z.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedPdfRooms([])}
                    className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 cursor-pointer"
                  >
                    ล้างทั้งหมด
                  </button>
                </div>
              </div>

              {/* Compact Multi-Select Room Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                {allRoomsData.map((rm) => {
                  const checked = selectedPdfRooms.includes(rm.room_number);
                  return (
                    <button
                      key={rm.room_number}
                      type="button"
                      onClick={() => togglePdfRoom(rm.room_number)}
                      className={`px-2.5 py-2 rounded-xl border text-left text-xs transition cursor-pointer flex items-center gap-1.5 ${
                        checked
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {checked ? <CheckSquare className="w-3.5 h-3.5 shrink-0" /> : <Square className="w-3.5 h-3.5 shrink-0" />}
                      <div className="min-w-0">
                        <div className="font-extrabold leading-none">{rm.room_number}</div>
                        <div className={`text-[10px] truncate mt-0.5 ${checked ? 'text-emerald-100' : 'text-slate-400'}`}>
                          ฿{formatNumber(rm.total_amount || 0)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PDF Pairs Sheets Container:
              Hidden visually off-screen by default (kept mounted ONLY when needed for Print or PDF export or Preview Modal!)
              so screen stays sleek per "ครึ่ง A4 2 ห้องบนหน้า A4 เฉพาะในไฟล์ PDF เท่านั้น" */}
          <div
            className={
              showPdfPreviewModal
                ? 'overflow-x-auto pb-6 print-only-container'
                : 'print-only-container fixed -left-[99999px] top-0 pointer-events-none opacity-100'
            }
          >
            {pdfPairs.map(([topDoc, bottomDoc], pIdx) => (
              <div
                key={`pair-${pIdx}`}
                ref={(el) => {
                  pdfPairSheetsRef.current[pIdx] = el;
                }}
                className="a4-pdf-pair-sheet"
              >
                <ReceiptHalfA4 doc={topDoc} settings={settings} editable={false} />
                <div className="receipt-divider" />
                {bottomDoc ? (
                  <ReceiptHalfA4 doc={bottomDoc} settings={settings} editable={false} />
                ) : (
                  <div className="half-a4-receipt flex items-center justify-center" style={{ backgroundColor: '#ffffff', color: '#94a3b8' }}>
                    <span className="text-xs italic">— พื้นที่ว่าง (จบบิลรายเดือนชุดนี้) —</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
