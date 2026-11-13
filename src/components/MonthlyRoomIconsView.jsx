import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Home, DoorOpen, CheckCircle2, Clock, AlertTriangle, Search, Sparkles,
  Building2, Layers, MapPin, ChevronLeft, ChevronRight, X, Calculator,
  History, SlidersHorizontal, ArrowUpRight, ArrowDownRight, Minus, Plus, Save, RefreshCw
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
      if (statusFilter === 'unrecorded' && item.is_recorded) return false;
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
      other_sign: otherNum < 0 ? '-' : '+',
      other_abs: Math.abs(otherNum),
      water_custom_override: item.water_calc_type === 'flat'
    });
    setActiveRoomDraft(prepared);
    setRetroactiveMode(Boolean(item.edit_count > 0 && item.is_recorded));
    setCorrectionReason(item.admin_correction_reason || 'แก้ไขตัวเลขมิเตอร์ที่จดคลาดเคลื่อน (Human Error)');
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
        sync_to_invoice: true,
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

  const getZoneIcon = (themeName) => {
    if (themeName === 'amber') return <Home className="w-4 h-4" />;
    if (themeName === 'indigo') return <Layers className="w-4 h-4" />;
    return <Building2 className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 1. Hero Header & Controls */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-700/60">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Sparkles className="w-3.5 h-3.5" />
                {dormName}
              </span>
              <span className="text-xs text-slate-300 bg-white/10 px-2.5 py-1 rounded-full">
                ซิงค์ตรง Supabase + BillAuditSubAgent
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              บันทึกบิลรายเดือนด้วยไอคอนห้องพัก &amp; เปรียบเทียบเดือนก่อน
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              แตะที่ไอคอนห้องพักเพื่อกรอกหน่วยน้ำ-ไฟ ดูเทียบเดือนที่ผ่านมา ({notebookData.prev_period?.month} {notebookData.prev_period?.year_be}) และบันทึกสมการอัตโนมัติ
            </p>
          </div>

          {/* Month / Year / Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="bg-white text-slate-900 rounded-xl px-3 py-2 text-sm font-bold shadow-sm min-h-[42px]"
            >
              {THAI_MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={billingYearBe}
              onChange={(e) => setBillingYearBe(Number(e.target.value))}
              className="bg-white text-slate-900 rounded-xl px-3 py-2 text-sm font-bold shadow-sm min-h-[42px]"
            >
              {[2568, 2569, 2570, 2571].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              onClick={handlePrepareNextMonth}
              disabled={loading}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow cursor-pointer flex items-center gap-1.5 min-h-[42px] transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>เตรียมเดือนถัดไป</span>
            </button>

            {onGoToReportPdf && (
              <button
                onClick={onGoToReportPdf}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow cursor-pointer flex items-center gap-1.5 min-h-[42px] transition"
              >
                <span>📄 รีพอร์ต A4 &amp; PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Public Overview Status Bar (ปุ่มสาธารณะแสดงผลการบันทึกแล้ว / ยังไม่ได้บันทึก) */}
        <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
          {/* Progress Overview */}
          <div className="lg:col-span-5 bg-white/10 rounded-2xl p-3.5 border border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-200">
                ความคืบหน้าการบันทึกบิล ({billingMonth} {billingYearBe})
              </span>
              <span className="font-extrabold text-emerald-300 text-sm">
                {summary.recorded_count || 0}/{summary.total_rooms || 0} ห้อง ({summary.completion_pct || 0}%)
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-900/70 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-500"
                style={{ width: `${summary.completion_pct || 0}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300">
              <span>ยอดรวมที่บันทึกแล้ว: <strong className="text-emerald-300">฿{formatCurrency(summary.recorded_revenue || 0)}</strong></span>
              <span>คาดการณ์ทั้งหอ: <strong className="text-white">฿{formatCurrency(summary.total_projected_revenue || 0)}</strong></span>
            </div>
          </div>

          {/* Interactive Public Filter Status Buttons */}
          <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-2xl border text-left transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 border-white shadow-lg ring-2 ring-emerald-400/60'
                  : 'bg-white/10 text-white border-white/15 hover:bg-white/15'
              }`}
            >
              <div className="text-[11px] font-semibold opacity-75">สถานะภาพรวม</div>
              <div className="text-sm sm:text-base font-extrabold flex items-center justify-between mt-0.5">
                <span>ทั้งหมด</span>
                <span className="px-2 py-0.5 rounded-lg bg-slate-900/10 text-xs">{summary.total_rooms || 0} ห้อง</span>
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('recorded')}
              className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-2xl border text-left transition cursor-pointer ${
                statusFilter === 'recorded'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-lg ring-2 ring-emerald-300'
                  : 'bg-emerald-500/15 text-emerald-100 border-emerald-400/30 hover:bg-emerald-500/25'
              }`}
            >
              <div className="text-[11px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>บันทึกแล้ว</span>
              </div>
              <div className="text-base sm:text-lg font-extrabold mt-0.5">
                {summary.recorded_count || 0} ห้อง
              </div>
            </button>

            <button
              onClick={() => setStatusFilter('unrecorded')}
              className={`flex-1 min-w-[135px] py-2.5 px-3 rounded-2xl border text-left transition cursor-pointer ${
                statusFilter === 'unrecorded'
                  ? 'bg-rose-500 text-white border-rose-300 shadow-lg ring-2 ring-rose-300'
                  : 'bg-rose-500/20 text-rose-100 border-rose-400/30 hover:bg-rose-500/30'
              }`}
            >
              <div className="text-[11px] font-bold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>ยังไม่ได้บันทึก</span>
              </div>
              <div className="text-base sm:text-lg font-extrabold mt-0.5">
                {summary.unrecorded_count ?? summary.pending_count ?? 0} ห้อง
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

                {/* Responsive Room Icons Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {items.map((room) => {
                    const isRec = Boolean(room.is_recorded);
                    const hasAnomaly =
                      room.electric_curr !== '' &&
                      ((parseFloat(room.electric_curr) < parseFloat(room.electric_prev)) ||
                        Number(room.electric_units) > 250);

                    return (
                      <button
                        key={room.room_number}
                        onClick={() => openRoomPopup(room)}
                        className={`group text-left rounded-2xl p-3.5 border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[146px] relative overflow-hidden active:scale-[0.98] ${
                          isRec
                            ? 'bg-gradient-to-b from-white to-emerald-50/70 border-emerald-400/70 hover:border-emerald-500 hover:shadow-lg shadow-xs'
                            : 'bg-gradient-to-b from-white to-rose-50/70 border-rose-300/80 hover:border-rose-500 hover:shadow-lg shadow-xs'
                        }`}
                      >
                        {/* Top Badge & Room Icon */}
                        <div className="flex items-start justify-between gap-1">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-105 ${
                              isRec
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-100 text-rose-600 border border-rose-200'
                            }`}
                          >
                            {isRec ? <Home className="w-5 h-5" /> : <DoorOpen className="w-5 h-5" />}
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isRec
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {isRec ? (
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
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                แก้ไข {room.edit_count} ครั้ง
                              </span>
                            )}
                            {hasAnomaly && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
                                ตรวจเลข!
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Room Number & Tenant */}
                        <div className="mt-2.5">
                          <div className="text-lg font-extrabold text-slate-900 leading-tight flex items-center justify-between">
                            <span>ห้อง {room.room_number}</span>
                          </div>
                          <div className="text-xs font-semibold text-slate-600 truncate mt-0.5">
                            {room.tenant_name || 'ห้องว่าง / ไม่ระบุชื่อ'}
                          </div>
                        </div>

                        {/* Quick Metrics + Total Footer */}
                        <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                          <div className="text-slate-500 font-semibold truncate">
                            {room.water_calc_type === 'meter'
                              ? `💧${room.water_units || 0}`
                              : `💧เหมา`}
                            {' • '}
                            ⚡{room.electric_units || 0}
                          </div>
                          <div className={`font-extrabold text-sm ${isRec ? 'text-emerald-700' : 'text-slate-700'}`}>
                            ฿{formatCurrency(room.total_amount || 0)}
                          </div>
                        </div>
                      </button>
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
