import React, { useState, useRef } from 'react';
import { Wallet, Plus, Trash2, Printer, FileDown, X } from 'lucide-react';
import ProfessionalAccountingReportA4 from './ProfessionalAccountingReportA4.jsx';
import { THAI_MONTHS, formatCurrency } from '../utils/bahtText.js';
import { exportA4ElementsToPdf } from '../utils/pdfGenerator.js';

export default function AccountingAndReportsView({
  dashboard = {},
  accountingList = [],
  rooms = [],
  settings = {},
  dashMonth,
  setDashMonth,
  dashYearBe,
  setDashYearBe,
  onRefresh,
  showToast
}) {
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'report'
  const [txModal, setTxModal] = useState(null);
  const reportRef = useRef(null);

  const ms = dashboard?.monthly_summary || {};

  const openNewTx = () => {
    setTxModal({
      tx_type: 'expense',
      category: 'ค่าซ่อมบำรุงห้องพัก',
      cost_nature: 'direct',
      title: '',
      description: '',
      amount: 0,
      tx_date: new Date().toISOString().slice(0, 10),
      billing_month: dashMonth,
      billing_year_be: dashYearBe,
      room_number: 'ส่วนกลาง',
      vendor_or_payee: '',
      payment_method: 'โอนเงิน',
      reference_doc: ''
    });
  };

  const saveTx = async (e) => {
    e.preventDefault();
    if (!txModal?.title?.trim()) return;
    try {
      const res = await fetch('/api/accounting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txModal)
      });
      if (!res.ok) throw new Error('บันทึกรายการบัญชีไม่สำเร็จ');
      if (showToast) showToast('บันทึกรายการบัญชีเรียบร้อย');
      setTxModal(null);
      if (onRefresh) await onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const deleteTx = async (id) => {
    if (!window.confirm('ต้องการลบรายการบัญชีนี้หรือไม่?')) return;
    try {
      const res = await fetch(`/api/accounting/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('ลบรายการไม่สำเร็จ');
      if (showToast) showToast('ลบรายการบัญชีเรียบร้อย');
      if (onRefresh) await onRefresh();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    try {
      await exportA4ElementsToPdf({
        elements: [reportRef.current],
        filename: `งบกำไรขาดทุน_${settings?.dorm_name || 'หอพักอิ่มสุข'}_${dashMonth}_${dashYearBe}.pdf`,
        orientation: 'portrait'
      });
      if (showToast) showToast('ดาวน์โหลด PDF รายงานงบกำไรขาดทุน A4 เรียบร้อย!');
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="no-print bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
              <Wallet className="w-3.5 h-3.5" />
              <span>{settings?.dorm_name || 'หอพักอิ่มสุข'} • Income &amp; Expense Accounting</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              บัญชีรายรับ-รายจ่าย ค่าซ่อมบำรุง และค่าใช้จ่ายแฝง (A4)
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

            <button
              onClick={openNewTx}
              className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>บันทึกรายจ่าย/ซ่อมบำรุง</span>
            </button>

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
              <span>พิมพ์งบ P&amp;L A4</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${viewMode === 'split' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              ตารางจัดการ + งบการเงิน A4
            </button>
            <button
              onClick={() => setViewMode('report')}
              className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${viewMode === 'report' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              เฉพาะงบการเงิน A4
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span>รายรับ: <strong className="text-emerald-700">฿{formatCurrency(ms.total_income || 0)}</strong></span>
            <span>รายจ่าย: <strong className="text-rose-600">-฿{formatCurrency(ms.total_expenses || 0)}</strong></span>
            <span className="font-extrabold bg-emerald-100 text-emerald-900 px-3 py-1 rounded-lg">
              กำไรสุทธิ: ฿{formatCurrency(ms.net_profit || 0)}
            </span>
          </div>
        </div>
      </div>

      {viewMode === 'split' && (
        <div className="no-print bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-800 text-sm">
            รายการบัญชีประจำเดือน {dashMonth} {dashYearBe} ({accountingList.length} รายการ)
          </div>
          <div className="divide-y divide-slate-200">
            {accountingList.map((tx) => (
              <div key={tx.id} className="p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-slate-400">{tx.tx_date}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      tx.tx_type === 'income' ? 'bg-emerald-100 text-emerald-800' : tx.cost_nature === 'hidden' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {tx.tx_type === 'income' ? 'รายรับเสริม' : tx.cost_nature === 'hidden' ? 'ค่าใช้จ่ายแฝง' : 'ต้นทุนทางตรง'}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{tx.title}</span>
                  </div>
                  <div className="text-slate-500">หมวด: {tx.category} • ห้อง/โซน: {tx.room_number || 'ส่วนกลาง'}</div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className={`font-extrabold text-sm ${tx.tx_type === 'income' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {tx.tx_type === 'income' ? '+' : '-'}฿{formatCurrency(tx.amount)}
                  </span>
                  <button
                    onClick={() => deleteTx(tx.id)}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                    title="ลบ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {!accountingList.length && (
              <div className="p-8 text-center text-slate-400 text-sm">ยังไม่มีรายการบันทึกในเดือนนี้</div>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto pb-4 print-only-container">
        <div ref={reportRef} className="inline-block min-w-full">
          <ProfessionalAccountingReportA4 dashboard={dashboard} transactions={accountingList} settings={settings} />
        </div>
      </div>

      {txModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={saveTx} className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">บันทึกรายการบัญชีหอพัก</h3>
              <button type="button" onClick={() => setTxModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">ประเภท</label>
                <select value={txModal.tx_type} onChange={(e) => setTxModal({ ...txModal, tx_type: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-bold">
                  <option value="expense">รายจ่าย / ซ่อมบำรุง / ค่าแฝง</option>
                  <option value="income">รายรับอื่นๆ เพิ่มเติม</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">ลักษณะต้นทุน</label>
                <select value={txModal.cost_nature} onChange={(e) => setTxModal({ ...txModal, cost_nature: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
                  <option value="direct">ต้นทุนทางตรง / ซ่อมบำรุง</option>
                  <option value="hidden">ค่าใช้จ่ายแฝง (Hidden Cost)</option>
                  <option value="fixed">ค่าใช้จ่ายคงที่</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="font-bold text-slate-700 block mb-1">ชื่อรายการ *</label>
                <input required value={txModal.title} onChange={(e) => setTxModal({ ...txModal, title: e.target.value })} placeholder="เช่น ซ่อมก๊อกน้ำห้อง 102, ค่าน้ำยาทำความสะอาด..." className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">หมวดหมู่</label>
                <select value={txModal.category} onChange={(e) => setTxModal({ ...txModal, category: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
                  <option value="ค่าซ่อมบำรุงห้องพัก">ค่าซ่อมบำรุงห้องพัก</option>
                  <option value="ต้นทุนสาธารณูปโภค (น้ำ-ไฟส่วนกลาง)">ต้นทุนสาธารณูปโภค (น้ำ-ไฟ)</option>
                  <option value="ค่าใช้จ่ายแฝงและวัสดุสิ้นเปลือง">ค่าใช้จ่ายแฝง/วัสดุสิ้นเปลือง</option>
                  <option value="อินเทอร์เน็ต/ขยะ/ส่วนกลาง">อินเทอร์เน็ต/ขยะ/ส่วนกลาง</option>
                  <option value="รายรับเสริมอื่นๆ">รายรับเสริมอื่นๆ</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">จำนวนเงิน (บาท) *</label>
                <input required type="number" min="0" value={txModal.amount} onChange={(e) => setTxModal({ ...txModal, amount: Number(e.target.value) })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-extrabold text-right" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">ห้อง / โซน</label>
                <select value={txModal.room_number} onChange={(e) => setTxModal({ ...txModal, room_number: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
                  <option value="ส่วนกลาง">ส่วนกลาง / ทั้งหอพัก</option>
                  {rooms.map((r) => <option key={r.id} value={r.room_number}>ห้อง {r.room_number}</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">วันที่</label>
                <input type="date" value={txModal.tx_date} onChange={(e) => setTxModal({ ...txModal, tx_date: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTxModal(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-xs cursor-pointer">ยกเลิก</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-rose-600 text-white font-extrabold text-xs cursor-pointer">บันทึกรายการ</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
