import React from 'react';
import { toThaiBahtText, formatNumber, getMonthNumber } from '../utils/bahtText.js';

export default function ProfessionalAccountingReportA4({ dashboard = {}, transactions = [], settings = {} }) {
  const ms = dashboard?.monthly_summary || {};
  const monthNum = getMonthNumber(dashboard?.month || 'พฤศจิกายน');
  const dormName = settings?.dorm_name || 'หอพักอิ่มสุข';
  const netProfit = ms.net_profit ?? (ms.total_revenue || 0);
  const bahtTextNet = toThaiBahtText(netProfit);

  return (
    <div className="a4-sheet p-8 bg-white text-slate-900 flex flex-col justify-between">
      <div className="space-y-4">
        {/* Formal Header */}
        <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-indigo-700">
              OFFICIAL FINANCIAL &amp; ACCOUNTING STATEMENT (A4)
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
              งบกำไรขาดทุนและรายงานบัญชีรายรับ-รายจ่ายหอพัก
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              โครงการ: <strong>{dormName}</strong> • บัญชีหลัก: {settings?.bank_name} {settings?.account_number} ({settings?.account_holder})
            </p>
          </div>
          <div className="text-right border border-slate-300 rounded-xl px-4 py-2 bg-slate-50">
            <div className="text-[11px] font-semibold text-slate-500">งวดบัญชีประจำเดือน</div>
            <div className="text-lg font-extrabold text-slate-900">{dashboard?.month} พ.ศ. {dashboard?.year_be}</div>
            <div className="text-[10px] text-slate-500">เลขที่เอกสาร: FIN-{dashboard?.year_be}{String(monthNum).padStart(2, '0')}</div>
          </div>
        </div>

        {/* Executive Summary Boxes */}
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/60">
            <div className="text-emerald-800 font-bold">1. รวมรายรับทั้งหมด</div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">฿{formatNumber(ms.total_income || ms.total_revenue || 0)}</div>
            <div className="text-[10px] text-emerald-700">บิลค่าเช่า {ms.invoice_count || 0} ห้อง + รายรับเสริม</div>
          </div>
          <div className="p-3 rounded-xl border border-rose-300 bg-rose-50/60">
            <div className="text-rose-800 font-bold">2. ต้นทุนทางตรง &amp; ซ่อมบำรุง</div>
            <div className="text-xl font-extrabold text-rose-700 mt-1">฿{formatNumber(ms.direct_expenses || 0)}</div>
            <div className="text-[10px] text-rose-700">ค่าน้ำ-ไฟหลัก + ซ่อมบำรุงห้องพัก</div>
          </div>
          <div className="p-3 rounded-xl border border-purple-300 bg-purple-50/60">
            <div className="text-purple-800 font-bold">3. ค่าใช้จ่ายแฝง (Hidden Costs)</div>
            <div className="text-xl font-extrabold text-purple-700 mt-1">฿{formatNumber(ms.hidden_expenses || 0)}</div>
            <div className="text-[10px] text-purple-700">วัสดุสิ้นเปลือง / เน็ต / ขยะ / ส่วนกลาง</div>
          </div>
          <div className="p-3 rounded-xl border-2 border-slate-900 bg-slate-900 text-white">
            <div className="text-emerald-300 font-bold">4. กำไรสุทธิ (Net Profit)</div>
            <div className="text-xl font-extrabold text-white mt-1">฿{formatNumber(netProfit)}</div>
            <div className="text-[10px] text-slate-300">อัตรากำไรสุทธิ {ms.profit_margin ?? 100}%</div>
          </div>
        </div>

        {/* Part 1: Income Breakdown */}
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider bg-slate-800 text-white px-3 py-1.5 rounded-t-lg">
            ส่วนที่ 1: งบสรุปรายรับ-รายจ่ายตามหมวดหมู่ (Income Breakdown)
          </h2>
          <table className="w-full text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                <th className="py-1.5 px-3 text-left border-r border-slate-300 w-[12%]">รหัสหมวด</th>
                <th className="py-1.5 px-3 text-left border-r border-slate-300 w-[56%]">รายการทางบัญชี</th>
                <th className="py-1.5 px-3 text-center border-r border-slate-300 w-[14%]">ประเภทต้นทุน</th>
                <th className="py-1.5 px-3 text-right w-[18%]">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr className="bg-emerald-50/40 font-semibold">
                <td className="py-1.5 px-3 border-r border-slate-300">REV-101</td>
                <td className="py-1.5 px-3 border-r border-slate-300">รายรับค่าเช่าห้องพักประจำเดือน ({ms.invoice_count || 0} ห้อง)</td>
                <td className="py-1.5 px-3 text-center border-r border-slate-300 text-emerald-700">รายรับหลัก</td>
                <td className="py-1.5 px-3 text-right text-emerald-700">{formatNumber(ms.room_revenue || 0)}</td>
              </tr>
              <tr className="bg-emerald-50/40 font-semibold">
                <td className="py-1.5 px-3 border-r border-slate-300">REV-102</td>
                <td className="py-1.5 px-3 border-r border-slate-300">รายรับค่าไฟฟ้าจากผู้เช่า ({formatNumber(ms.electric_units || 0)} หน่วย)</td>
                <td className="py-1.5 px-3 text-center border-r border-slate-300 text-emerald-700">สาธารณูปโภค</td>
                <td className="py-1.5 px-3 text-right text-emerald-700">{formatNumber(ms.electric_revenue || 0)}</td>
              </tr>
              <tr className="bg-emerald-50/40 font-semibold">
                <td className="py-1.5 px-3 border-r border-slate-300">REV-103</td>
                <td className="py-1.5 px-3 border-r border-slate-300">รายรับค่าน้ำประปาจากผู้เช่า (มิเตอร์ {ms.water_units || 0} หน่วย + เหมาจ่าย)</td>
                <td className="py-1.5 px-3 text-center border-r border-slate-300 text-emerald-700">สาธารณูปโภค</td>
                <td className="py-1.5 px-3 text-right text-emerald-700">{formatNumber(ms.water_revenue || 0)}</td>
              </tr>
              {Number(ms.deposit_deductions || 0) > 0 && (
                <tr className="bg-amber-50/40">
                  <td className="py-1.5 px-3 border-r border-slate-300">REV-104</td>
                  <td className="py-1.5 px-3 border-r border-slate-300">หักคืนเงินมัดจำผู้เช่าย้ายออกระหว่างงวด</td>
                  <td className="py-1.5 px-3 text-center border-r border-slate-300 text-amber-700">รายการหักลด</td>
                  <td className="py-1.5 px-3 text-right text-amber-700">-{formatNumber(ms.deposit_deductions)}</td>
                </tr>
              )}
              {Number(ms.extra_income || 0) > 0 && (
                <tr className="bg-emerald-50/40 font-semibold">
                  <td className="py-1.5 px-3 border-r border-slate-300">REV-105</td>
                  <td className="py-1.5 px-3 border-r border-slate-300">รายรับอื่นๆ / ค่าบริการเสริม</td>
                  <td className="py-1.5 px-3 text-center border-r border-slate-300 text-emerald-700">รายรับเสริม</td>
                  <td className="py-1.5 px-3 text-right text-emerald-700">{formatNumber(ms.extra_income)}</td>
                </tr>
              )}
              <tr className="bg-slate-100 font-extrabold border-t border-b border-slate-300">
                <td className="py-1.5 px-3 border-r border-slate-300" colSpan={3}>รวมรายรับสุทธิประจำเดือน (Total Operating Income)</td>
                <td className="py-1.5 px-3 text-right text-emerald-800">฿{formatNumber(ms.total_income || ms.total_revenue || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Part 2: Expense & Maintenance Ledger */}
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-wider bg-slate-800 text-white px-3 py-1.5 rounded-t-lg">
            ส่วนที่ 2: ทะเบียนรายการค่าซ่อมบำรุง ต้นทุนสาธารณูปโภค และค่าใช้จ่ายแฝง ({transactions.length} รายการ)
          </h2>
          <table className="w-full text-[11.5px] border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                <th className="py-1.5 px-2 text-left border-r border-slate-300">วันที่</th>
                <th className="py-1.5 px-2 text-left border-r border-slate-300">เลขที่อ้างอิง</th>
                <th className="py-1.5 px-2 text-left border-r border-slate-300">หมวดหมู่</th>
                <th className="py-1.5 px-2 text-left border-r border-slate-300">รายการ</th>
                <th className="py-1.5 px-2 text-center border-r border-slate-300">ห้อง/โซน</th>
                <th className="py-1.5 px-2 text-center border-r border-slate-300">ลักษณะต้นทุน</th>
                <th className="py-1.5 px-2 text-right">จำนวนเงิน (บาท)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="py-1 px-2 border-r border-slate-300 whitespace-nowrap">{tx.tx_date}</td>
                  <td className="py-1 px-2 border-r border-slate-300 font-mono text-[10.5px]">{tx.reference_doc || tx.tx_code}</td>
                  <td className="py-1 px-2 border-r border-slate-300">{tx.category}</td>
                  <td className="py-1 px-2 border-r border-slate-300 font-medium">{tx.title}</td>
                  <td className="py-1 px-2 border-r border-slate-300 text-center">{tx.room_number || 'ส่วนกลาง'}</td>
                  <td className="py-1 px-2 border-r border-slate-300 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      tx.cost_nature === 'hidden'
                        ? 'bg-purple-100 text-purple-800'
                        : tx.tx_type === 'income'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}>
                      {tx.tx_type === 'income' ? 'รายรับเสริม' : (tx.cost_nature === 'hidden' ? 'ค่าใช้จ่ายแฝง' : 'ต้นทุนทางตรง')}
                    </span>
                  </td>
                  <td className={`py-1 px-2 text-right font-bold ${tx.tx_type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {tx.tx_type === 'income' ? '+' : '-'}{formatNumber(tx.amount)}
                  </td>
                </tr>
              ))}
              {!transactions.length && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-slate-400">ยังไม่มีรายการบันทึกค่าใช้จ่ายในเดือนนี้</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t border-slate-300 font-bold">
                <td colSpan={6} className="py-1.5 px-3 text-right border-r border-slate-300">รวมรายจ่ายและต้นทุนแฝงทั้งสิ้น</td>
                <td className="py-1.5 px-2 text-right text-rose-700">-฿{formatNumber(ms.total_expenses || 0)}</td>
              </tr>
              <tr className="bg-slate-900 text-white font-extrabold text-sm">
                <td colSpan={6} className="py-2 px-3 text-right border-r border-slate-700">
                  คงเหลือกำไรสุทธิเข้าบัญชีหอพัก ({bahtTextNet})
                </td>
                <td className="py-2 px-2 text-right text-emerald-400">฿{formatNumber(netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Sign-off Footer */}
      <div className="pt-4 border-t border-slate-300 flex items-end justify-between text-xs">
        <div className="text-slate-500 space-y-0.5">
          <div className="font-bold text-slate-800">หมายเหตุทางบัญชี ({dormName}):</div>
          <div className="text-[10.5px]">• ต้นทุนทางตรง (Direct Cost): ค่าไฟฟ้า-ประปาส่วนกลาง และค่าซ่อมบำรุงห้องพักตามใบเสร็จจริง</div>
          <div className="text-[10.5px]">• ค่าใช้จ่ายแฝง (Hidden Cost): ค่าวัสดุทำความสะอาด อินเทอร์เน็ตส่วนกลาง ค่าขยะ และค่าเสื่อมอุปกรณ์ย่อย</div>
        </div>
        <div className="flex gap-10 text-center text-[11px]">
          <div>
            <div className="w-36 border-b border-dotted border-slate-500 mb-1">&nbsp;</div>
            <div className="font-semibold">ผู้ตรวจสอบบัญชี / แอดมิน</div>
            <div className="text-[10px] text-slate-400">วันที่ ......./......./...........</div>
          </div>
          <div>
            <div className="w-36 border-b border-dotted border-slate-500 mb-1">&nbsp;</div>
            <div className="font-semibold">({settings?.account_holder || 'นาง เอมอร ไทยนอ'})</div>
            <div className="text-[10px] text-slate-400">เจ้าของกิจการหอพัก / ผู้อนุมัติ</div>
          </div>
        </div>
      </div>
    </div>
  );
}
