import React, { useState, useEffect, useCallback } from 'react';
import { Bot, History, Search, RefreshCw, Calculator } from 'lucide-react';
import { THAI_MONTHS, formatCurrency } from '../utils/bahtText.js';

export default function BillAuditLogsView({ billingMonth, billingYearBe, showToast }) {
  const [subTab, setSubTab] = useState('subagent'); // 'subagent' | 'history'
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState({});
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(String(billingYearBe || 2569));
  const [filterRoom, setFilterRoom] = useState('');
  const [filterTenant, setFilterTenant] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterMonth) p.set('billing_month', filterMonth);
      if (filterYear) p.set('billing_year_be', filterYear);
      if (filterRoom.trim()) p.set('room_number', filterRoom.trim());
      if (filterTenant.trim()) p.set('tenant_name', filterTenant.trim());
      const res = await fetch(`/api/bill-audit-logs?${p.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.items || []);
        setAuditStats(data.stats || {});
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterRoom, filterTenant]);

  const fetchHistoryLogs = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (filterRoom.trim()) p.set('room_number', filterRoom.trim());
      if (filterTenant.trim()) p.set('tenant_name', filterTenant.trim());
      if (filterAction) p.set('action_type', filterAction);
      const res = await fetch(`/api/logs?${p.toString()}`);
      if (res.ok) {
        setHistoryLogs(await res.json());
      }
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filterRoom, filterTenant, filterAction]);

  useEffect(() => {
    if (subTab === 'subagent') fetchAuditLogs();
    else fetchHistoryLogs();
  }, [subTab, fetchAuditLogs, fetchHistoryLogs]);

  const formatDateTime = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const statusBadge = (status) => {
    const map = {
      recorded: { cls: 'bg-emerald-100 text-emerald-800', label: 'บันทึกใหม่' },
      updated: { cls: 'bg-sky-100 text-sky-800', label: 'อัปเดตบิล' },
      retroactive_fix: { cls: 'bg-amber-100 text-amber-800', label: 'แก้ไขย้อนหลัง' },
      backfilled: { cls: 'bg-slate-100 text-slate-700', label: 'ข้อมูลตั้งต้น' }
    };
    const m = map[status] || { cls: 'bg-slate-100 text-slate-700', label: status };
    return <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${m.cls}`}>{m.label}</span>;
  };

  return (
    <div className="space-y-5">
      {/* Header & Switcher */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              <Bot className="w-3.5 h-3.5" />
              <span>Supabase BillAuditSubAgent &amp; History Logs</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              ล็อกไฟล์เอเจนต์บันทึกสมการบิลรายห้อง &amp; ประวัติระบบทั้งหมด
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              บันทึกสมการ: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 font-semibold">ค่าเช่า + (หน่วยน้ำ × เรท) + (หน่วยไฟ × เรท) ± อื่นๆ = ผลลัพธ์</code> แยกทุกบิลบน Supabase
            </p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold self-start">
            <button
              onClick={() => setSubTab('subagent')}
              className={`px-3.5 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                subTab === 'subagent' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>ล็อกสมการบิลรายห้อง ({auditLogs.length})</span>
            </button>
            <button
              onClick={() => setSubTab('history')}
              className={`px-3.5 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                subTab === 'history' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600'
              }`}
            >
              <History className="w-4 h-4" />
              <span>ประวัติกิจกรรม ({historyLogs.length})</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs pt-2 border-t border-slate-100">
          {subTab === 'subagent' ? (
            <>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold"
              >
                <option value="">ทุกเดือน</option>
                {THAI_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold"
              >
                <option value="">ทุกปี พ.ศ.</option>
                {[2568, 2569, 2570].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </>
          ) : (
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="border border-slate-300 rounded-xl px-3 py-2 bg-white font-semibold col-span-2"
            >
              <option value="">ทุกประเภทกิจกรรม</option>
              <option value="METER_NOTE_SAVED">บันทึกมิเตอร์รายเดือน</option>
              <option value="HUMAN_ERROR_CORRECTION">แอดมินแก้ไขย้อนหลัง (Human Error)</option>
              <option value="INVOICE_CREATED">ออกใบเสร็จใหม่</option>
              <option value="MOVE_OUT_DEDUCTION">ย้ายออก/หักค่ามัดจำ</option>
              <option value="ROOM_TRANSFER">ย้ายห้องผู้เช่า</option>
              <option value="ZONE_CREATED">เพิ่ม/แก้ไขโซน</option>
              <option value="ACCOUNTING_EXPENSE">บันทึกรายจ่าย/ซ่อมบำรุง</option>
            </select>
          )}

          <input
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            placeholder="เลขห้อง..."
            className="border border-slate-300 rounded-xl px-3 py-2 bg-white"
          />
          <input
            value={filterTenant}
            onChange={(e) => setFilterTenant(e.target.value)}
            placeholder="ชื่อผู้เช่า..."
            className="border border-slate-300 rounded-xl px-3 py-2 bg-white"
          />
          <button
            onClick={() => (subTab === 'subagent' ? fetchAuditLogs() : fetchHistoryLogs())}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl px-3 py-2 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรชล็อก</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab 1: BillAuditSubAgent Equation Logs */}
      {subTab === 'subagent' ? (
        <div className="space-y-4">
          {/* Quick Formula Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs">
              <div className="text-slate-500 font-semibold">จำนวนบิลในล็อก</div>
              <div className="text-xl font-extrabold text-slate-900 mt-0.5">{auditStats.total_records || 0} บิล</div>
            </div>
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs">
              <div className="text-slate-500 font-semibold">รวมค่าเช่าห้อง</div>
              <div className="text-lg font-extrabold text-indigo-700 mt-0.5">฿{formatCurrency(auditStats.sum_room_rate || 0)}</div>
            </div>
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs">
              <div className="text-slate-500 font-semibold">รวมค่าน้ำ</div>
              <div className="text-lg font-extrabold text-sky-600 mt-0.5">฿{formatCurrency(auditStats.sum_water_total || 0)}</div>
            </div>
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs">
              <div className="text-slate-500 font-semibold">รวมค่าไฟ</div>
              <div className="text-lg font-extrabold text-amber-600 mt-0.5">฿{formatCurrency(auditStats.sum_electric_total || 0)}</div>
            </div>
            <div className="bg-slate-900 text-white rounded-2xl p-3.5 border border-slate-800 shadow-xs col-span-2 sm:col-span-1">
              <div className="text-emerald-300 font-semibold">ผลรวมตามสมการ</div>
              <div className="text-lg font-extrabold mt-0.5">฿{formatCurrency(auditStats.sum_computed_total || 0)}</div>
            </div>
          </div>

          {/* Desktop Table + Mobile Stack */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white uppercase">
                    <th className="p-3">วันเวลาบันทึก</th>
                    <th className="p-3">งวดเดือน</th>
                    <th className="p-3">ห้อง / โซน</th>
                    <th className="p-3">ผู้เช่า</th>
                    <th className="p-3 text-right">ค่าเช่า</th>
                    <th className="p-3 text-center">น้ำ (หน่วย×เรท)</th>
                    <th className="p-3 text-center">ไฟ (หน่วย×เรท)</th>
                    <th className="p-3 text-right">อื่นๆ (+/-)</th>
                    <th className="p-3">สมการคำนวณเต็ม (BillAuditSubAgent)</th>
                    <th className="p-3 text-right">ยอดสุทธิ</th>
                    <th className="p-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 whitespace-nowrap text-slate-500">{formatDateTime(log.created_at)}</td>
                      <td className="p-3 whitespace-nowrap font-semibold">{log.billing_month} {log.billing_year_be}</td>
                      <td className="p-3">
                        <span className="font-extrabold text-slate-900">ห้อง {log.room_number}</span>
                        {log.zone && <div className="text-[10px] text-slate-400">{log.zone}</div>}
                      </td>
                      <td className="p-3 font-medium">{log.tenant_name || '-'}</td>
                      <td className="p-3 text-right font-semibold">{formatCurrency(log.room_rate)}</td>
                      <td className="p-3 text-center">
                        {log.water_calc_type === 'meter'
                          ? `${log.water_units}×${log.water_rate} = ${formatCurrency(log.water_total)}`
                          : `เหมา ${formatCurrency(log.water_total)}`}
                      </td>
                      <td className="p-3 text-center">
                        {log.electric_units}×{log.electric_rate} = {formatCurrency(log.electric_total)}
                      </td>
                      <td className={`p-3 text-right font-bold ${Number(log.other_amount_signed) < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {Number(log.other_amount_signed) > 0 ? `+${formatCurrency(log.other_amount_signed)}` : formatCurrency(log.other_amount_signed)}
                      </td>
                      <td className="p-3 font-mono text-[11px] bg-slate-50 text-indigo-900">{log.formula_expression}</td>
                      <td className="p-3 text-right font-extrabold text-emerald-700 text-sm">฿{formatCurrency(log.computed_total)}</td>
                      <td className="p-3 text-center">{statusBadge(log.action_status)}</td>
                    </tr>
                  ))}
                  {!auditLogs.length && (
                    <tr>
                      <td colSpan={11} className="p-10 text-center text-slate-400">
                        {loading ? 'กำลังโหลดข้อมูลล็อกเอเจนต์จาก Supabase...' : 'ยังไม่มีล็อกสมการตามเงื่อนไขที่เลือก'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-200">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-slate-900 text-sm">ห้อง {log.room_number}</span>
                      <span className="text-xs text-slate-500 ml-2">{log.tenant_name}</span>
                    </div>
                    {statusBadge(log.action_status)}
                  </div>
                  <div className="font-mono text-xs bg-indigo-50 text-indigo-950 p-2 rounded-xl border border-indigo-100">
                    {log.formula_expression}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{log.billing_month} {log.billing_year_be} • {formatDateTime(log.created_at)}</span>
                    <span className="font-extrabold text-emerald-700 text-sm">฿{formatCurrency(log.computed_total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Sub-Tab 2: General System History Logs */
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="divide-y divide-slate-200">
            {historyLogs.map((h) => (
              <div key={h.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 text-xs">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-bold text-[10px]">{h.action_type}</span>
                    {h.room_number && <span className="font-extrabold text-slate-900">ห้อง {h.room_number}</span>}
                    {h.tenant_name && <span className="text-indigo-700 font-bold">({h.tenant_name})</span>}
                    <span className="text-slate-400">{formatDateTime(h.created_at)}</span>
                  </div>
                  <div className="text-slate-700 text-sm">{h.description}</div>
                </div>
                {h.amount !== null && h.amount !== undefined && (
                  <div className="font-extrabold text-emerald-700 text-sm shrink-0">
                    ฿{formatCurrency(h.amount)}
                  </div>
                )}
              </div>
            ))}
            {!historyLogs.length && (
              <div className="p-10 text-center text-slate-400 text-sm">
                {loading ? 'กำลังโหลดประวัติกิจกรรม...' : 'ไม่มีประวัติกิจกรรมตามตัวกรอง'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
