import React, { useState, useRef } from 'react';
import { BarChart3, Printer, FileDown } from 'lucide-react';
import ExecutiveInfographicA4 from './ExecutiveInfographicA4.jsx';
import { THAI_MONTHS, formatCurrency } from '../utils/bahtText.js';
import { exportA4ElementsToPdf } from '../utils/pdfGenerator.js';

export default function DashboardInfographicView({
  dashboard = {},
  settings = {},
  dashMonth,
  setDashMonth,
  dashYearBe,
  setDashYearBe,
  showToast
}) {
  const [viewMode, setViewMode] = useState('infographic'); // 'infographic' | 'yearly'
  const a4Ref = useRef(null);
  const ms = dashboard?.monthly_summary || {};
  const ys = dashboard?.yearly_summary || {};

  const handleDownloadPdf = async () => {
    if (!a4Ref.current) return;
    try {
      await exportA4ElementsToPdf({
        elements: [a4Ref.current],
        filename: `Executive_Infographic_${settings?.dorm_name || 'หอพักอิ่มสุข'}_${dashMonth}_${dashYearBe}.pdf`,
        orientation: 'portrait'
      });
      if (showToast) showToast('ดาวน์โหลด PDF แดชบอร์ดผู้บริหาร A4 เรียบร้อย!');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="no-print bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{settings?.dorm_name || 'หอพักอิ่มสุข'} • Executive Summary</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            แดชบอร์ดผู้บริหาร &amp; สรุปรายเดือนอินโฟกราฟิก A4
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dashMonth}
            onChange={(e) => setDashMonth(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold bg-white min-h-[42px]"
          >
            {THAI_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={dashYearBe}
            onChange={(e) => setDashYearBe(Number(e.target.value))}
            className="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold bg-white min-h-[42px]"
          >
            {[2568, 2569, 2570, 2571].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setViewMode('infographic')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${viewMode === 'infographic' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
            >
              อินโฟกราฟิก A4
            </button>
            <button
              onClick={() => setViewMode('yearly')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer ${viewMode === 'yearly' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
            >
              สรุป 12 เดือน (รายปี)
            </button>
          </div>

          <button
            onClick={handleDownloadPdf}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
          >
            <FileDown className="w-4 h-4" />
            <span>ดาวน์โหลด PDF</span>
          </button>
          <button
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์ A4</span>
          </button>
        </div>
      </div>

      {/* Quick Mobile-Friendly Summary Strip (.no-print) */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">รายรับเดือน {dashMonth}</div>
          <div className="text-xl font-extrabold text-emerald-700 mt-0.5">฿{formatCurrency(ms.total_income || ms.total_revenue || 0)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">รายจ่าย &amp; ต้นทุนแฝง</div>
          <div className="text-xl font-extrabold text-rose-600 mt-0.5">฿{formatCurrency(ms.total_expenses || 0)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">กำไรสุทธิเดือนนี้</div>
          <div className="text-xl font-extrabold text-indigo-700 mt-0.5">฿{formatCurrency(ms.net_profit ?? ms.total_revenue ?? 0)}</div>
        </div>
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xs">
          <div className="text-xs text-emerald-300 font-semibold">กำไรสุทธิทั้งปี {dashYearBe}</div>
          <div className="text-xl font-extrabold mt-0.5">฿{formatCurrency(ys.net_profit ?? ys.total_revenue ?? 0)}</div>
        </div>
      </div>

      {viewMode === 'infographic' ? (
        <div className="overflow-x-auto pb-4 print-only-container">
          <div ref={a4Ref} className="inline-block min-w-full">
            <ExecutiveInfographicA4 dashboard={dashboard} settings={settings} />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 font-extrabold text-slate-900 text-sm">
            ตารางผลประกอบการรายเดือนตลอดปี พ.ศ. {dashYearBe} ({settings?.dorm_name || 'หอพักอิ่มสุข'})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase">
                  <th className="p-3">เดือน</th>
                  <th className="p-3 text-center">จำนวนบิล</th>
                  <th className="p-3 text-right">รายรับรวม</th>
                  <th className="p-3 text-right">ต้นทุน/ซ่อมบำรุง</th>
                  <th className="p-3 text-right">กำไรสุทธิ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(dashboard?.by_month || []).map((m) => (
                  <tr key={m.month} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{m.month}</td>
                    <td className="p-3 text-center">{m.invoice_count}</td>
                    <td className="p-3 text-right font-semibold text-emerald-700">฿{formatCurrency(m.total_income || 0)}</td>
                    <td className="p-3 text-right font-semibold text-rose-600">-฿{formatCurrency(m.total_expenses || 0)}</td>
                    <td className="p-3 text-right font-extrabold text-indigo-700">฿{formatCurrency(m.net_profit || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
