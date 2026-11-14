import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Home, DoorOpen, CheckCircle2, Clock, AlertTriangle, Search, Sparkles,
  Building2, Layers, MapPin, ChevronLeft, ChevronRight, X, Calculator,
  History, SlidersHorizontal, ArrowUpRight, ArrowDownRight, Minus, Plus, Save, RefreshCw, RotateCcw
} from 'lucide-react';
import { THAI_MONTHS, formatCurrency, toThaiBahtText } from '../utils/bahtText.js';

const ZONE_THEMES = {
  amber: {
    header: 'from-amber-500 to-orange-600',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    pillActive: 'bg-amber-600 text-white border-amber-600'
  },
  emerald: {
    header: 'from-emerald-600 to-teal-700',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    pillActive: 'bg-emerald-600 text-white border-emerald-600'
  },
  indigo: {
    header: 'from-indigo-600 to-violet-700',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    pillActive: 'bg-indigo-600 text-white border-indigo-600'
  },
  sky: {
    header: 'from-sky-500 to-cyan-600',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    pillActive: 'bg-sky-600 text-white border-sky-600'
  },
  rose: {
    header: 'from-rose-500 to-pink-600',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    pillActive: 'bg-rose-600 text-white border-rose-600'
  },
  violet: {
    header: 'from-purple-600 to-fuchsia-700',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    pillActive: 'bg-purple-600 text-white border-purple-600'
  }
};

function computeRoomDraft(draft) {
  const next = { ...draft };
  const wCalc = next.water_calc_type || 'meter';
  if (wCalc === 'meter') {
    const wp = parseFloat(next.water_prev);
    const wc = parseFloat(next.water_curr);
    const units = !isNaN(wp) && !isNaN(wc) && wc >= wp ? wc - wp : 0;
    const rate = Number(next.water_unit_price ?? 10);
    next.water_units = units;
    next.water_total = units * rate;
  } else if (wCalc === 'per_person') {
    next.water_units = 0;
    const occ = Math.max(1, Number(next.occupant_count || 1));
    next.water_total = next.water_custom_override ? Number(next.water_total || 0) : occ * 100;
  } else {
    next.water_units = 0;
    next.water_total = Number(next.water_total ?? 100);
  }

  const ep = parseFloat(next.electric_prev);
  const ec = parseFloat(next.electric_curr);
  const eUnits = !isNaN(ep) && !isNaN(ec) && ec >= ep ? ec - ep : 0;
  const eRate = Number(next.electric_unit_price ?? 8);
  next.electric_units = eUnits;
  next.electric_total = eUnits * eRate;

  const roomRate = Number(next.room_rate || 0);
  const sign = next.other_sign === '-' ? -1 : 1;
  const mag = Math.abs(Number(next.other_abs ?? Math.abs(Number(next.other_amount || 0))));
  const otherAmt = sign * mag;
  next.other_amount = otherAmt;

  const depDeduct = next.is_move_out ? Number(next.deposit_deduction || 0) : 0;
  next.total_amount = roomRate + Number(next.water_total || 0) + next.electric_total + otherAmt - depDeduct;
  return next;
}

function buildFormulaPreview(draft) {
  const roomRate = Number(draft.room_rate || 0);
  const wCalc = draft.water_calc_type || 'meter';
  const wUnits = Number(draft.water_units || 0);
  const wRate = wCalc === 'meter' ? Number(draft.water_unit_price || 10) : Number(draft.water_total || 0);
  const wExpr = wCalc === 'meter'
    ? `(${formatCurrency(wUnits)} × ${formatCurrency(wRate)})`
    : `(เหมาจ่าย ${formatCurrency(draft.water_total || 0)})`;

  const eUnits = Number(draft.electric_units || 0);
  const eRate = Number(draft.electric_unit_price || 8);
  const signedOther = Number(draft.other_amount || 0) - (draft.is_move_out ? Number(draft.deposit_deduction || 0) : 0);
  const otherExpr = signedOther < 0 ? `- ${formatCurrency(Math.abs(signedOther))}` : `+ ${formatCurrency(signedOther)}`;

  return `${formatCurrency(roomRate)} + ${wExpr} + (${formatCurrency(eUnits)} × ${formatCurrency(eRate)}) ${otherExpr} = ${formatCurrency(draft.total_amount || 0)} บ.`;
}

export default function MonthlyRoomIconsView({
  settings,
  zones = [],
  billingMonth,
  setBillingMonth,
  billingYearBe,
  setBillingYearBe,
  onSyncSuccess,
  onGoToZones,
  onGoToReportPdf,
  showToast
}) {
  const [zoneFilter, setZoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'recorded' | 'unrecorded'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [notebookData, setNotebookData] = useState({
    prev_period: { month: 'ตุลาคม', year_be: 2569 },
    next_period: { month: 'ธันวาคม', year_be: 2569 },
    summary: {
      total_rooms: 0,
      recorded_count: 0,
      pending_count: 0,
      unrecorded_count: 0,
      completion_pct: 0,
      total_projected_revenue: 0,
      recorded_revenue: 0,
      total_electric_units: 0,
      total_water_units: 0,
      anomalies: []
    },
    all_rooms_items: [],
    items: []
  });

  // Popup state for selected room
  const [activeRoomDraft, setActiveRoomDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [retroactiveMode, setRetroactiveMode] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('แก้ไขตัวเลขมิเตอร์ที่จดคลาดเคลื่อน (Human Error)');

  const fetchRoomsData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        billing_month: billingMonth,
        billing_year_be: String(billingYearBe),
        page: '1',
        page_size: '200'
      });
      const res = await fetch(`/api/meter-notes?${params.toString()}`);
      if (!res.ok) throw new Error('โหลดข้อมูลมิเตอร์ไม่สำเร็จ');
      const data = await res.json();
      setNotebookData(data);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [billingMonth, billingYearBe]);

  useEffect(() => {
    fetchRoomsData();
  }, [fetchRoomsData]);

  const allItems = notebookData.all_rooms_items || notebookData.items || [];

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (zoneFilter && item.zone !== zoneFilter) return false;
      if (statusFilter === 'recorded' && !item.is_recorded) return false;
      if (statusFilter === 'unrecorded' && (item.is_recorded || item.is_vacant)) return false;
      if (statusFilter === 'vacant' && !item.is_vacant) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchRoom = (item.room_number || '').toLowerCase().includes(q);
        const matchName = (item.tenant_name || '').toLowerCase().includes(q);
        return matchRoom || matchName;
      }
      return true;
    });
  }, [allItems, zoneFilter, statusFilter, searchQuery]);

  // Group filtered items by Zone in defined dorm_zones order
  const groupedByZone = useMemo(() => {
    const zoneMetaMap = new Map((zones || []).map((z) => [z.name, z]));
    const groups = new Map();

    // Pre-populate active zones in sorted order if no specific filter conflicts
    for (const z of zones || []) {
      groups.set(z.name, { zoneObj: z, items: [], allZoneItems: allItems.filter((i) => i.zone === z.name) });
    }

    for (const item of filteredItems) {
      const zName = item.zone || 'ทั่วไป';
      if (!groups.has(zName)) {
        groups.set(zName, {
          zoneObj: zoneMetaMap.get(zName) || { name: zName, color_theme: 'sky', description: '' },
          items: [],
          allZoneItems: allItems.filter((i) => (i.zone || 'ทั่วไป') === zName)
        });
      }
      groups.get(zName).items.push(item);
    }

    return Array.from(groups.values()).filter((g) => g.items.length > 0);
  }, [filteredItems, zones, allItems]);

  const openRoomPopup = (item) => {
    const otherNum = Number(item.other_amount || 0);
    const prepared = computeRoomDraft({
      ...item,
      occupancy_status: item.occupancy_status || (item.is_vacant ? 'vacant' : 'occupied'),
      also_update_room_status: false,
      other_sign: otherNum < 0 ? '-' : '+',
      other_abs: Math.abs(otherNum),
      water_custom_override: item.water_calc_type === 'flat'
    });
    setActiveRoomDraft(prepared);
    setRetroactiveMode(Boolean(item.edit_count > 0 && item.is_recorded));
    setCorrectionReason(item.admin_correction_reason || 'แก้ไขตัวเลขมิเตอร์ที่จดคลาดเคลื่อน (Human Error)');
  };

  const setDraftOccupancyStatus = (nextOccStatus) => {
    setActiveRoomDraft((prev) => {
      if (!prev) return prev;
      const isVac = nextOccStatus === 'vacant';
      const next = {
        ...prev,
        occupancy_status: nextOccStatus,
        is_vacant: isVac,
        room_rate: isVac ? 0 : (Number(prev.room_rate) > 0 ? prev.room_rate : (prev.prev_snapshot?.room_rate || 2500)),
        water_total: isVac && prev.water_calc_type !== 'meter' ? 0 : prev.water_total,
        tenant_name: isVac ? '' : (prev.tenant_name || prev.prev_snapshot?.tenant_name || ''),
        note_status: isVac ? 'vacant' : 'pending'
      };
      return computeRoomDraft(next);
    });
  };

  const updateDraftField = (field, value) => {
    setActiveRoomDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      if (field === 'water_total' && prev.water_calc_type === 'per_person') {
        next.water_custom_override = true;
      }
      if (field === 'occupant_count' && prev.water_calc_type === 'per_person') {
        next.water_custom_override = false;
      }
      return computeRoomDraft(next);
    });
  };

  const handleSavePopup = async (andMoveNext = false) => {
    if (!activeRoomDraft) return;
    setSaving(true);
    try {
      const payload = {
        ...activeRoomDraft,
        billing_month: billingMonth,
        billing_year_be: billingYearBe,
        sync_to_invoice: activeRoomDraft.occupancy_status !== 'vacant',
        also_update_room_status: Boolean(activeRoomDraft.also_update_room_status),
        is_retroactive_correction: retroactiveMode,
        admin_correction_reason: retroactiveMode ? correctionReason : ''
      };
      const res = await fetch('/api/meter-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');

      if (showToast) {
        showToast(`บันทึกห้อง ${activeRoomDraft.room_number} เรียบร้อย (${data.formula?.formula_expression || ''})`);
      }

      await fetchRoomsData();
      if (onSyncSuccess) onSyncSuccess();

      if (andMoveNext) {
        const idx = filteredItems.findIndex((i) => i.room_number === activeRoomDraft.room_number);
        if (idx >= 0 && idx + 1 < filteredItems.length) {
          openRoomPopup(filteredItems[idx + 1]);
        } else {
          setActiveRoomDraft(null);
        }
      } else {
        setActiveRoomDraft(null);
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClearRoomNote = async (roomObj, keepPopupOpen = false) => {
    if (!roomObj?.room_number) return;
    const confirmed = window.confirm(
      `ต้องการเคลียร์ค่าการบันทึกเดือน ${billingMonth} ${billingYearBe} ของห้อง ${roomObj.room_number} ให้กลับเป็น "ยังไม่ได้บันทึก" ใช่หรือไม่?\n\n(ข้อมูลผู้เช่า ค่าน้ำ-ค่าไฟ อัตราเรท และเลขมิเตอร์ตั้งต้นจากฐานข้อมูลยังคงอยู่ครบ)`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const res = await fetch('/api/meter-notes/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_number: roomObj.room_number,
          billing_month: billingMonth,
          billing_year_be: billingYearBe,
          reset_room_status_to_occupied: true
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เคลียร์ค่าไม่สำเร็จ');

      if (showToast) {
        showToast(`เคลียร์ค่าบันทึกห้อง ${roomObj.room_number} เดือน ${billingMonth} แล้ว (กลับเป็นสถานะยังไม่บันทึก)`);
      }

      const freshRes = await fetch(
        `/api/meter-notes?billing_month=${encodeURIComponent(billingMonth)}&billing_year_be=${billingYearBe}&page=1&page_size=200`
      );
      const freshData = await freshRes.json();
      if (freshRes.ok) {
        setNotebookData(freshData);
        if (keepPopupOpen) {
          const freshItem = (freshData.all_rooms_items || freshData.items || []).find(
            (i) => i.room_number === roomObj.room_number
          );
          if (freshItem) openRoomPopup(freshItem);
          else setActiveRoomDraft(null);
        }
      } else {
        await fetchRoomsData();
        if (keepPopupOpen) setActiveRoomDraft(null);
      }

      if (onSyncSuccess) onSyncSuccess();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrepareNextMonth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/meter-notes/prepare-next-month', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_month: billingMonth, from_year_be: billingYearBe })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เตรียมรอบบิลถัดไปไม่สำเร็จ');
      if (showToast) {
        showToast(`เตรียมสมุดจดรอบบิล ${data.target_month} ${data.target_year_be} จำนวน ${data.prepared_count} ห้องเรียบร้อย`);
      }
      setBillingMonth(data.target_month);
      setBillingYearBe(data.target_year_be);
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const navigatePopupRoom = (direction) => {
    if (!activeRoomDraft) return;
    const idx = filteredItems.findIndex((i) => i.room_number === activeRoomDraft.room_number);
    const nextIdx = idx + direction;
    if (nextIdx >= 0 && nextIdx < filteredItems.length) {
      openRoomPopup(filteredItems[nextIdx]);
    }
  };

  const summary = notebookData.summary || {};
  const dormName = settings?.dorm_name || 'หอพักอิ่มสุข';
  const totalRoomsNum = Math.max(Number(summary.total_rooms || 0), 1);
  const recordedCountNum = Number(summary.recorded_count || 0);
  const unrecordedCountNum = Number(summary.unrecorded_count ?? summary.pending_count ?? 0);
  const pctNum = Number(summary.completion_pct || 0);

  // SVG Donut Ring Geometry (Inspired by Reference App Progress Card)
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const recordedDash = (recordedCountNum / totalRoomsNum) * ringCircumference;
  const pendingDash = (unrecordedCountNum / totalRoomsNum) * ringCircumference;

  const getZoneIcon = (themeName) => {
    if (themeName === 'amber') return <Home className="w-4 h-4" />;
    if (themeName === 'indigo') return <Layers className="w-4 h-4" />;
    return <Building2 className="w-4 h-4" />;
  };

  return (
    <div className="space-y-5">
      {/* 1. Bright Colorful Hero Summary Card (Inspired by Reference Donut Card) */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-[0_10px_35px_-12px_rgba(37,99,235,0.16)] border border-slate-200/80 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-[#0066EE] border border-blue-200">
                <Sparkles className="w-3.5 h-3.5" />
                {dormName}
              </span>
              <span className="text-xs font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full">
                ซิงค์ตรง Supabase + BillAuditSubAgent
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              บันทึกบิลรายเดือน &amp; เปรียบเทียบเดือนก่อน
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              แตะที่การ์ดห้องพักเพื่อกรอกหน่วยน้ำ-ไฟ ดูเทียบเดือนที่ผ่านมา ({notebookData.prev_period?.month} {notebookData.prev_period?.year_be}) และบันทึกสมการอัตโนมัติ
            </p>
          </div>

          {/* Month / Year / Colorful Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="bg-blue-50/70 border border-blue-200 text-slate-900 rounded-2xl px-3.5 py-2 text-sm font-extrabold shadow-xs min-h-[42px] cursor-pointer"
            >
              {THAI_MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={billingYearBe}
              onChange={(e) => setBillingYearBe(Number(e.target.value))}
              className="bg-blue-50/70 border border-blue-200 text-slate-900 rounded-2xl px-3.5 py-2 text-sm font-extrabold shadow-xs min-h-[42px] cursor-pointer"
            >
              {[2568, 2569, 2570, 2571].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={handlePrepareNextMonth}
              disabled={loading}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-extrabold px-4 py-2 rounded-2xl text-xs sm:text-sm shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 min-h-[42px] transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>เตรียมเดือนถัดไป</span>
            </button>

            {onGoToReportPdf && (
              <button
                onClick={onGoToReportPdf}
                className="bg-gradient-to-r from-[#0066EE] to-violet-600 hover:from-blue-600 hover:to-violet-500 text-white font-extrabold px-4 py-2 rounded-2xl text-xs sm:text-sm shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-1.5 min-h-[42px] transition"
              >
                <span>📄 รีพอร์ต A4 &amp; PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Donut Ring + Colorful Metric Rows & Public Filter Buttons */}
        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Left: Donut Ring Summary (Reference App Style) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#F7FAFF] to-blue-50/60 rounded-3xl p-4 border border-blue-100 flex items-center gap-4">
            <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                <circle
                  cx="56"
                  cy="56"
                  r={ringRadius}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="10"
                />
                {unrecordedCountNum > 0 && (
                  <circle
                    cx="56"
                    cy="56"
                    r={ringRadius}
                    fill="none"
                    stroke="#FF8A00"
                    strokeWidth="10"
                    strokeDasharray={`${pendingDash} ${ringCircumference}`}
                    strokeDashoffset={-recordedDash}
                    strokeLinecap="round"
                  />
                )}
                {recordedCountNum > 0 && (
                  <circle
                    cx="56"
                    cy="56"
                    r={ringRadius}
                    fill="none"
                    stroke="#0066EE"
                    strokeWidth="10"
                    strokeDasharray={`${recordedDash} ${ringCircumference}`}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-slate-900 leading-none">{pctNum}%</span>
                <span className="text-[10px] font-bold text-slate-500 mt-0.5">
                  {recordedCountNum}/{summary.total_rooms || 0} ห้อง
                </span>
              </div>
            </div>

            <div className="flex-1 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0066EE]" />
                  บันทึกบิลแล้ว
                </span>
                <strong className="text-[#0066EE] font-black">{recordedCountNum} ห้อง</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF8A00]" />
                  รอจดมิเตอร์
                </span>
                <strong className="text-orange-600 font-black">{unrecordedCountNum} ห้อง</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  ห้องว่างเดือนนี้
                </span>
                <strong className="text-cyan-700 font-black">{summary.vacant_count || 0} ห้อง</strong>
              </div>
              <div className="pt-1.5 border-t border-blue-200/60 flex items-center justify-between">
                <span className="font-bold text-slate-500">ยอดที่บันทึกแล้ว</span>
                <strong className="text-emerald-600 font-black text-sm">
                  ฿{formatCurrency(summary.recorded_revenue || 0)}
                </strong>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>คาดการณ์ทั้งหอ</span>
                <span className="font-bold text-slate-700">฿{formatCurrency(summary.total_projected_revenue || 0)}</span>
              </div>
            </div>
          </div>

          {/* Right: Interactive Colorful Public Status Buttons */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => setStatusFilter('all')}
              className={`py-3 px-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-br from-[#0066EE] to-indigo-600 text-white border-[#0066EE] shadow-lg shadow-blue-500/25'
                  : 'bg-blue-50/70 text-slate-800 border-blue-200 hover:bg-blue-100/70'
              }`}
            >
              <div className={`text-[11px] font-bold ${statusFilter === 'all' ? 'text-blue-100' : 'text-blue-700'}`}>
                ภาพรวมทั้งหมด
              </div>
              <div className="text-base sm:text-lg font-black flex items-center justify-between mt-1">
                <span>ทั้งหมด</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white text-[#0066EE]'}`}>
                  {summary.total_rooms || 0}
                </span>
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('recorded')}
              className={`py-3 px-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                statusFilter === 'recorded'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/25'
                  : 'bg-emerald-50/80 text-emerald-900 border-emerald-200 hover:bg-emerald-100/80'
              }`}
            >
              <div className={`text-[11px] font-bold flex items-center gap-1 ${statusFilter === 'recorded' ? 'text-emerald-50' : 'text-emerald-700'}`}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>บันทึกแล้ว</span>
              </div>
              <div className="text-base sm:text-lg font-black mt-1">
                {recordedCountNum} ห้อง
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('unrecorded')}
              className={`py-3 px-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                statusFilter === 'unrecorded'
                  ? 'bg-gradient-to-br from-amber-500 to-rose-500 text-white border-orange-500 shadow-lg shadow-orange-500/25'
                  : 'bg-amber-50/80 text-amber-900 border-amber-200 hover:bg-amber-100/80'
              }`}
            >
              <div className={`text-[11px] font-bold flex items-center gap-1 ${statusFilter === 'unrecorded' ? 'text-amber-50' : 'text-orange-700'}`}>
                <Clock className="w-3.5 h-3.5" />
                <span>รอจดบิล</span>
              </div>
              <div className="text-base sm:text-lg font-black mt-1">
                {unrecordedCountNum} ห้อง
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('vacant')}
              className={`py-3 px-3.5 rounded-2xl border-2 text-left transition cursor-pointer ${
                statusFilter === 'vacant'
                  ? 'bg-gradient-to-br from-cyan-500 to-sky-600 text-white border-cyan-500 shadow-lg shadow-cyan-500/25'
                  : 'bg-cyan-50/80 text-cyan-900 border-cyan-200 hover:bg-cyan-100/80'
              }`}
            >
              <div className={`text-[11px] font-bold flex items-center gap-1 ${statusFilter === 'vacant' ? 'text-cyan-50' : 'text-cyan-700'}`}>
                <DoorOpen className="w-3.5 h-3.5" />
                <span>ห้องว่าง</span>
              </div>
              <div className="text-base sm:text-lg font-black mt-1">
                {summary.vacant_count || 0} ห้อง
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Zone Filter Chips + Search Bar + Zone Shortcut */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setZoneFilter('')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition min-h-[38px] ${
              zoneFilter === ''
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            ทุกโซน ({allItems.length})
          </button>

          {(zones || []).map((z) => {
            const zRooms = allItems.filter((i) => i.zone === z.name);
            const zRec = zRooms.filter((i) => i.is_recorded).length;
            const theme = ZONE_THEMES[z.color_theme] || ZONE_THEMES.emerald;
            const isActive = zoneFilter === z.name;
            return (
              <button
                key={z.id || z.name}
                onClick={() => setZoneFilter(isActive ? '' : z.name)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer transition flex items-center gap-1.5 min-h-[38px] ${
                  isActive ? theme.pillActive : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {getZoneIcon(z.color_theme)}
                <span>{z.name}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {zRec}/{zRooms.length}
                </span>
              </button>
            );
          })}

          {onGoToZones && (
            <button
              onClick={onGoToZones}
              className="px-3 py-2 rounded-xl text-xs font-bold border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer flex items-center gap-1 min-h-[38px]"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>จัดการโซน</span>
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาเลขห้อง หรือชื่อผู้เช่า..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
          />
        </div>
      </div>

      {/* Anomaly Alert if Human Error detected */}
      {summary.anomalies && summary.anomalies.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex flex-wrap items-center gap-2 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold">พบจุดสังเกตที่ควรตรวจสอบ ({summary.anomalies.length} ห้อง):</span>
          {summary.anomalies.map((a) => (
            <button
              key={a.room_number}
              onClick={() => {
                const target = allItems.find((i) => i.room_number === a.room_number);
                if (target) openRoomPopup(target);
              }}
              className="bg-white border border-amber-300 px-2.5 py-1 rounded-lg font-bold hover:bg-amber-100 cursor-pointer"
            >
              ห้อง {a.room_number}: {a.issue}
            </button>
          ))}
        </div>
      )}

      {/* 4. Room Icon Grid Grouped by Zone */}
      {loading && allItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-500">
          กำลังดึงข้อมูลห้องพักและมิเตอร์เดือนก่อนจาก Supabase...
        </div>
      ) : groupedByZone.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-2">
          <div className="text-3xl">🔍</div>
          <div className="font-bold text-slate-700">ไม่พบห้องพักตามเงื่อนไขที่เลือก</div>
          <button
            onClick={() => {
              setStatusFilter('all');
              setZoneFilter('');
              setSearchQuery('');
            }}
            className="text-xs font-bold text-emerald-600 underline cursor-pointer"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByZone.map(({ zoneObj, items, allZoneItems }) => {
            const theme = ZONE_THEMES[zoneObj.color_theme] || ZONE_THEMES.emerald;
            const zRecCount = allZoneItems.filter((i) => i.is_recorded).length;
            return (
              <div key={zoneObj.name} className="space-y-3">
                {/* Zone Section Banner */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${theme.header} text-white flex items-center justify-center shadow-sm`}>
                      {getZoneIcon(zoneObj.color_theme)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-900">{zoneObj.name}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${theme.badge}`}>
                          บันทึกแล้ว {zRecCount}/{allZoneItems.length} ห้อง
                        </span>
                      </div>
                      {zoneObj.description && (
                        <p className="text-xs text-slate-500">{zoneObj.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Responsive Colorful Room Icons Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {items.map((room) => {
                    const isRec = Boolean(room.is_recorded);
                    const isVacant = Boolean(room.is_vacant || room.occupancy_status === 'vacant');
                    const hasAnomaly =
                      room.electric_curr !== '' &&
                      ((parseFloat(room.electric_curr) < parseFloat(room.electric_prev)) ||
                        Number(room.electric_units) > 250);

                    return (
                      <div
                        key={room.room_number}
                        role="button"
                        tabIndex={0}
                        onClick={() => openRoomPopup(room)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openRoomPopup(room);
                          }
                        }}
                        className={`group text-left rounded-3xl bg-white border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[164px] relative overflow-hidden active:scale-[0.98] shadow-[0_6px_20px_-8px_rgba(37,99,235,0.14)] hover:shadow-xl hover:-translate-y-1 ${
                          isVacant
                            ? 'border-cyan-300 hover:border-cyan-500 bg-cyan-50/20'
                            : isRec
                              ? 'border-emerald-300 hover:border-emerald-500'
                              : 'border-amber-300/90 hover:border-[#0066EE]'
                        }`}
                      >
                        {/* Colorful Top Accent Strip */}
                        <div
                          className={`h-2 w-full ${
                            isVacant
                              ? 'bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-500'
                              : isRec
                                ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500'
                                : 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500'
                          }`}
                        />

                        <div className="p-3.5 flex-1 flex flex-col justify-between">
                          {/* Top Badge & Room Icon */}
                          <div className="flex items-start justify-between gap-1.5">
                            <div
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 text-white ${
                                isVacant
                                  ? 'bg-gradient-to-br from-cyan-500 to-sky-600'
                                  : isRec
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                                    : 'bg-gradient-to-br from-amber-500 to-rose-500'
                              }`}
                            >
                              {isRec ? <Home className="w-5 h-5" /> : <DoorOpen className="w-5 h-5" />}
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  isVacant
                                    ? 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                                    : isRec
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : 'bg-orange-100 text-orange-800 border border-orange-200'
                                }`}
                              >
                                {isVacant ? (
                                  <>
                                    <DoorOpen className="w-3 h-3" />
                                    <span>ห้องว่าง</span>
                                  </>
                                ) : isRec ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>บันทึกแล้ว</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3" />
                                    <span>ยังไม่บันทึก</span>
                                  </>
                                )}
                              </span>

                              {room.edit_count > 0 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800">
                                  แก้ไข {room.edit_count} ครั้ง
                                </span>
                              )}
                              {hasAnomaly && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">
                                  ตรวจเลข!
                                </span>
                              )}
                              {(isRec || isVacant) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClearRoomNote(room, false);
                                  }}
                                  title="เคลียร์ค่าบันทึกเดือนนี้ (กลับเป็นยังไม่บันทึก)"
                                  className="inline-flex items-center gap-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
                                >
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  <span>ล้างค่า</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Room Number & Tenant */}
                          <div className="mt-2.5">
                            <div className="text-lg font-black text-slate-900 leading-tight">
                              ห้อง {room.room_number}
                            </div>
                            <div className="text-xs font-bold text-slate-500 truncate mt-0.5">
                              {room.tenant_name || 'ห้องว่าง / ไม่ระบุชื่อ'}
                            </div>
                          </div>

                          {/* Colorful Utility Chips + Total Footer */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1 text-[10px] font-extrabold">
                              <span className="px-1.5 py-0.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
                                {room.water_calc_type === 'meter' ? `💧${room.water_units || 0}` : '💧เหมา'}
                              </span>
                              <span className="px-1.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                                ⚡{room.electric_units || 0}
                              </span>
                            </div>
                            <div className={`font-black text-sm ${isRec ? 'text-emerald-600' : 'text-[#0066EE]'}`}>
                              ฿{formatCurrency(room.total_amount || 0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Interactive Room Comparison & Entry Popup Modal */}
      {activeRoomDraft && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveRoomDraft(null);
          }}
        >
          <div className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[93vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  activeRoomDraft.is_recorded ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                }`}>
                  <Home className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-extrabold">
                      ห้อง {activeRoomDraft.room_number}
                    </h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/15 text-slate-200 font-bold">
                      {activeRoomDraft.zone}
                    </span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-extrabold ${
                      activeRoomDraft.is_recorded ? 'bg-emerald-400 text-slate-950' : 'bg-rose-400 text-slate-950'
                    }`}>
                      {activeRoomDraft.is_recorded ? 'บันทึกแล้ว' : 'รอการบันทึก'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 truncate">
                    ประจำเดือน {billingMonth} {billingYearBe} • ผู้เช่า: {activeRoomDraft.tenant_name || '-'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActiveRoomDraft(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer shrink-0"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
              {/* PREVIOUS MONTH COMPARISON BOX (ซิงค์จาก Supabase) */}
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/90 to-sky-50/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-indigo-950">
                    <History className="w-4 h-4 text-indigo-600" />
                    <span>
                      ข้อมูลเปรียบเทียบเดือนที่ผ่านมา บน Supabase ({activeRoomDraft.prev_snapshot?.month || notebookData.prev_period?.month} {activeRoomDraft.prev_snapshot?.year_be || notebookData.prev_period?.year_be})
                    </span>
                  </div>
                  {activeRoomDraft.prev_snapshot?.has_prev_record ? (
                    <span className="text-[11px] font-bold bg-indigo-600 text-white px-2.5 py-0.5 rounded-full">
                      ยอดเดือนก่อน: ฿{formatCurrency(activeRoomDraft.prev_snapshot.total_amount)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full">
                      ยังไม่มีประวัติบิลเดือนก่อนหน้า
                    </span>
                  )}
                </div>

                {activeRoomDraft.prev_snapshot?.has_prev_record && (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="bg-white/90 rounded-xl p-2.5 border border-indigo-100">
                        <div className="text-[11px] text-slate-500 font-semibold">ค่าเช่าเดือนก่อน</div>
                        <div className="text-sm font-extrabold text-slate-900 mt-0.5">
                          ฿{formatCurrency(activeRoomDraft.prev_snapshot.room_rate)}
                        </div>
                      </div>

                      <div className="bg-white/90 rounded-xl p-2.5 border border-sky-100">
                        <div className="text-[11px] text-sky-700 font-semibold">💧 ค่าน้ำเดือนก่อน</div>
                        {activeRoomDraft.prev_snapshot.water_calc_type === 'meter' ? (
                          <div className="font-bold text-slate-900 mt-0.5">
                            {activeRoomDraft.prev_snapshot.water_prev} → {activeRoomDraft.prev_snapshot.water_curr}
                            <span className="text-sky-700 ml-1">({activeRoomDraft.prev_snapshot.water_units} หน่วย)</span>
                          </div>
                        ) : (
                          <div className="font-bold text-slate-900 mt-0.5">เหมาจ่าย</div>
                        )}
                        <div className="text-[11px] text-slate-500">เป็นเงิน ฿{formatCurrency(activeRoomDraft.prev_snapshot.water_total)}</div>
                      </div>

                      <div className="bg-white/90 rounded-xl p-2.5 border border-amber-100">
                        <div className="text-[11px] text-amber-700 font-semibold">⚡ ค่าไฟเดือนก่อน</div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {activeRoomDraft.prev_snapshot.electric_prev} → {activeRoomDraft.prev_snapshot.electric_curr}
                          <span className="text-amber-700 ml-1">({activeRoomDraft.prev_snapshot.electric_units} หน่วย)</span>
                        </div>
                        <div className="text-[11px] text-slate-500">เป็นเงิน ฿{formatCurrency(activeRoomDraft.prev_snapshot.electric_total)}</div>
                      </div>

                      <div className="bg-white/90 rounded-xl p-2.5 border border-indigo-100">
                        <div className="text-[11px] text-slate-500 font-semibold">📊 ส่วนต่างเทียบเดือนนี้</div>
                        <div className="mt-0.5 space-y-0.5 font-bold">
                          {(() => {
                            const eDiff = Number(activeRoomDraft.electric_units || 0) - Number(activeRoomDraft.prev_snapshot.electric_units || 0);
                            const tDiff = Number(activeRoomDraft.total_amount || 0) - Number(activeRoomDraft.prev_snapshot.total_amount || 0);
                            return (
                              <>
                                <div className={`text-[11px] flex items-center gap-0.5 ${eDiff > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                  {eDiff >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  <span>ไฟ {eDiff >= 0 ? `+${eDiff}` : eDiff} หน่วย</span>
                                </div>
                                <div className={`text-xs flex items-center gap-0.5 ${tDiff > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                  <span>ยอดรวม {tDiff >= 0 ? `+${formatCurrency(tDiff)}` : formatCurrency(tDiff)} บ.</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {activeRoomDraft.prev_snapshot.formula_expression && (
                      <div className="text-[11px] font-mono text-indigo-800 bg-white/70 px-3 py-1.5 rounded-lg border border-indigo-100">
                        สมการเดือนก่อน: {activeRoomDraft.prev_snapshot.formula_expression}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ROOM STATUS & FREE MONTHLY CONFIGURATION BAR (ก่อนออกบิล) */}
              <div className="rounded-2xl border-2 border-cyan-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-indigo-50 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-extrabold text-slate-800">
                    สถานะห้องพักในเดือน {billingMonth} {billingYearBe} (กำหนดอิสระก่อนออกบิล)
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'occupied', label: 'มีผู้เช่า', active: 'bg-emerald-600 text-white border-emerald-600' },
                      { id: 'vacant', label: 'ห้องว่าง (0 บ.)', active: 'bg-cyan-600 text-white border-cyan-600' },
                      { id: 'maintenance', label: 'ซ่อมบำรุง', active: 'bg-amber-600 text-white border-amber-600' }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDraftOccupancyStatus(opt.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition ${
                          (activeRoomDraft.occupancy_status || 'occupied') === opt.id
                            ? `${opt.active} shadow-sm`
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(activeRoomDraft.also_update_room_status)}
                    onChange={(e) => updateDraftField('also_update_room_status', e.target.checked)}
                    className="w-4 h-4 accent-cyan-600 rounded"
                  />
                  <span>อัปเดตสถานะหลักของห้อง {activeRoomDraft.room_number} ด้วย (ยังคงประวัติผู้เช่าเดิมในห้องไว้ครบถ้วน)</span>
                </label>

                {activeRoomDraft.occupancy_status === 'vacant' && (
                  <div className="text-[11px] font-bold text-cyan-900 bg-white/85 px-3 py-1.5 rounded-xl border border-cyan-200">
                    ✓ กำหนดเป็น <strong>ห้องว่าง</strong> สำหรับเดือนนี้แล้ว — ค่าห้องตั้งต้นเป็น 0 บาท และจะไม่ออกบิลอัตโนมัติ (สามารถแก้ไขค่าได้อิสระ)
                  </div>
                )}
              </div>

              {/* CURRENT MONTH ENTRY FORM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อผู้เช่า / ผู้ใช้</label>
                  <input
                    value={activeRoomDraft.tenant_name || ''}
                    onChange={(e) => updateDraftField('tenant_name', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="ระบุชื่อผู้เช่า..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ค่าเช่าห้อง (บาท)</label>
                  <input
                    type="number"
                    value={activeRoomDraft.room_rate ?? 0}
                    onChange={(e) => updateDraftField('room_rate', e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Water & Electric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Water Card */}
                <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-sky-900">💧 ค่าน้ำประปา</span>
                    <select
                      value={activeRoomDraft.water_calc_type || 'meter'}
                      onChange={(e) => updateDraftField('water_calc_type', e.target.value)}
                      className="text-xs font-bold bg-white border border-sky-300 rounded-lg px-2 py-1 text-sky-900"
                    >
                      <option value="meter">คิดตามมิเตอร์น้ำ</option>
                      <option value="per_person">เหมาจ่ายตามจำนวนคน</option>
                      <option value="flat">เหมาจ่ายคงที่</option>
                    </select>
                  </div>

                  {activeRoomDraft.water_calc_type === 'meter' ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">ครั้งก่อน</label>
                          <input
                            value={activeRoomDraft.water_prev ?? ''}
                            onChange={(e) => updateDraftField('water_prev', e.target.value)}
                            className="w-full border border-sky-300 rounded-xl px-2.5 py-2 bg-white text-center font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-sky-800 mb-1">ครั้งหลัง (จดใหม่)</label>
                          <input
                            value={activeRoomDraft.water_curr ?? ''}
                            onChange={(e) => updateDraftField('water_curr', e.target.value)}
                            className="w-full border-2 border-sky-500 rounded-xl px-2.5 py-2 bg-white text-center font-mono font-extrabold text-sky-900"
                            placeholder="ใส่เลข"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-600 mb-1">เรท (บ./หน่วย)</label>
                          <input
                            type="number"
                            value={activeRoomDraft.water_unit_price ?? 10}
                            onChange={(e) => updateDraftField('water_unit_price', e.target.value)}
                            className="w-full border border-sky-300 rounded-xl px-2.5 py-2 bg-white text-center font-bold"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between text-xs font-bold bg-white/80 px-3 py-2 rounded-xl border border-sky-200 text-sky-900">
                        <span>ใช้ไป {activeRoomDraft.water_units || 0} หน่วย</span>
                        <span>= ฿{formatCurrency(activeRoomDraft.water_total || 0)}</span>
                      </div>
                    </>
                  ) : activeRoomDraft.water_calc_type === 'per_person' ? (
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1">จำนวนผู้พัก (คน)</label>
                        <input
                          type="number"
                          min="1"
                          value={activeRoomDraft.occupant_count ?? 1}
                          onChange={(e) => updateDraftField('occupant_count', e.target.value)}
                          className="w-full border border-sky-300 rounded-xl px-3 py-2 bg-white text-center font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-sky-800 mb-1">ค่าน้ำเหมาจ่าย (บาท)</label>
                        <input
                          type="number"
                          value={activeRoomDraft.water_total ?? 100}
                          onChange={(e) => updateDraftField('water_total', e.target.value)}
                          className="w-full border-2 border-sky-500 rounded-xl px-3 py-2 bg-white text-right font-extrabold text-sky-900"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs">
                      <label className="block font-semibold text-sky-800 mb-1">ยอดค่าน้ำเหมาจ่าย (บาท)</label>
                      <input
                        type="number"
                        value={activeRoomDraft.water_total ?? 100}
                        onChange={(e) => updateDraftField('water_total', e.target.value)}
                        className="w-full border-2 border-sky-500 rounded-xl px-3 py-2 bg-white text-right font-extrabold text-sky-900"
                      />
                    </div>
                  )}
                </div>

                {/* Electric Card */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-amber-900">⚡ ค่าไฟฟ้า</span>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      คำนวณอัตโนมัติ
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">ครั้งก่อน</label>
                      <input
                        value={activeRoomDraft.electric_prev ?? ''}
                        onChange={(e) => updateDraftField('electric_prev', e.target.value)}
                        className="w-full border border-amber-300 rounded-xl px-2.5 py-2 bg-white text-center font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-amber-900 mb-1">ครั้งหลัง (จดใหม่)</label>
                      <input
                        value={activeRoomDraft.electric_curr ?? ''}
                        onChange={(e) => updateDraftField('electric_curr', e.target.value)}
                        className="w-full border-2 border-amber-500 rounded-xl px-2.5 py-2 bg-white text-center font-mono font-extrabold text-amber-950"
                        placeholder="ใส่เลข"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">เรท (บ./หน่วย)</label>
                      <input
                        type="number"
                        value={activeRoomDraft.electric_unit_price ?? 8}
                        onChange={(e) => updateDraftField('electric_unit_price', e.target.value)}
                        className="w-full border border-amber-300 rounded-xl px-2.5 py-2 bg-white text-center font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs font-bold bg-white/80 px-3 py-2 rounded-xl border border-amber-200 text-amber-900">
                    <span>ใช้ไฟ {activeRoomDraft.electric_units || 0} หน่วย</span>
                    <span>= ฿{formatCurrency(activeRoomDraft.electric_total || 0)}</span>
                  </div>
                </div>
              </div>

              {/* Other Charges (+/-) & Move-out Deduction */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                    ค่าใช้จ่ายอื่นๆ (เพิ่มค่าใช้จ่าย หรือ หักลบ/ส่วนลด)
                  </span>
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => updateDraftField('other_sign', '+')}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer ${
                        activeRoomDraft.other_sign !== '-' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>บวกเพิ่ม</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDraftField('other_sign', '-')}
                      className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer ${
                        activeRoomDraft.other_sign === '-' ? 'bg-rose-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>หักลบออก</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="sm:col-span-2">
                    <input
                      value={activeRoomDraft.other_description || ''}
                      onChange={(e) => updateDraftField('other_description', e.target.value)}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white"
                      placeholder="คำอธิบายรายการอื่นๆ เช่น ค่ารีโมท/ค่าขยะ หรือ ส่วนลด..."
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      value={activeRoomDraft.other_abs ?? 0}
                      onChange={(e) => updateDraftField('other_abs', e.target.value)}
                      className={`w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-right font-extrabold ${
                        activeRoomDraft.other_sign === '-' ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                      placeholder="จำนวนเงิน (บาท)"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                  <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(activeRoomDraft.is_move_out)}
                      onChange={(e) => updateDraftField('is_move_out', e.target.checked)}
                      className="w-4 h-4 accent-rose-600 rounded"
                    />
                    <span>ย้ายออก / หักค่ามัดจำ</span>
                  </label>

                  {activeRoomDraft.is_move_out && (
                    <div className="flex items-center gap-2">
                      <span className="text-rose-700 font-bold">ยอดหักค่ามัดจำ:</span>
                      <input
                        type="number"
                        value={activeRoomDraft.deposit_deduction ?? 2500}
                        onChange={(e) => updateDraftField('deposit_deduction', e.target.value)}
                        className="w-28 border border-rose-300 rounded-lg px-2 py-1 bg-white text-right font-bold text-rose-700"
                      />
                      <span className="text-slate-500">บาท</span>
                    </div>
                  )}

                  <label className="flex items-center gap-2 font-semibold text-amber-800 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={retroactiveMode}
                      onChange={(e) => setRetroactiveMode(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                    <span>โหมดแก้ไขย้อนหลัง (Human Error)</span>
                  </label>
                </div>

                {retroactiveMode && (
                  <input
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    className="w-full border border-amber-300 rounded-xl px-3 py-2 text-xs bg-amber-50 text-amber-950 font-semibold"
                    placeholder="ระบุเหตุผลการแก้ไขย้อนหลัง (ระบบจะปรับมิเตอร์เริ่มต้นเดือนถัดไปให้ตรงอัตโนมัติ)..."
                  />
                )}
              </div>

              {/* LIVE EQUATION BREAKDOWN BOX (BillAuditSubAgent Formula) */}
              <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-2 border border-slate-700 shadow-inner">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <Calculator className="w-4 h-4" />
                    <span>สมการเอเจนต์ย่อย (ค่าเช่า + (น้ำ × เรท) + (ไฟ × เรท) ± อื่นๆ)</span>
                  </span>
                  <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded-full">BillAuditSubAgent</span>
                </div>
                <div className="font-mono text-sm sm:text-base font-extrabold text-amber-300 break-words">
                  {buildFormulaPreview(activeRoomDraft)}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800 text-xs">
                  <span className="text-slate-300">{toThaiBahtText(activeRoomDraft.total_amount)}</span>
                  <span className="text-xl font-extrabold text-emerald-400">
                    รวมสุทธิ ฿{formatCurrency(activeRoomDraft.total_amount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div className="px-4 sm:px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigatePopupRoom(-1)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>ห้องก่อนหน้า</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigatePopupRoom(1)}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1"
                >
                  <span>ห้องถัดไป</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                {(activeRoomDraft.is_recorded || activeRoomDraft.is_vacant || activeRoomDraft.id) && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleClearRoomNote(activeRoomDraft, true)}
                    className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-60 border border-rose-200 text-xs font-extrabold text-rose-700 cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>ล้างค่าบันทึกเดือนนี้</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSavePopup(false)}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold shadow cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'กำลังบันทึก...' : 'บันทึกบิลนี้'}</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSavePopup(true)}
                  className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold shadow cursor-pointer flex items-center gap-1.5"
                >
                  <span>บันทึก &amp; ห้องถัดไป</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
