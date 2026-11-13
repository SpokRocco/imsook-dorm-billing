<template>
  <div class="a4-sheet p-7 bg-white text-slate-800 flex flex-col justify-between relative overflow-hidden">
    <!-- Decorative Top Accent Bar -->
    <div class="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-emerald-600 via-teal-500 to-indigo-600"></div>

    <div class="space-y-4">
      <!-- 1. Infographic Header Banner -->
      <div class="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 shadow-md flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-3xl shadow-lg">
            🏢
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                EXECUTIVE INFOGRAPHIC REPORT (A4)
              </span>
              <span class="text-xs text-slate-300">สำหรับเจ้าของหอพักและผู้บริหาร</span>
            </div>
            <h1 class="text-2xl font-extrabold tracking-tight mt-1">
              {{ settings?.dorm_name || 'หอพักเอมอร' }} — รายงานสรุปผลประกอบการประจำเดือน
            </h1>
            <p class="text-xs text-slate-300 mt-0.5">
              บัญชีรับโอนหลัก: {{ settings?.bank_name }} {{ settings?.account_number }} ({{ settings?.account_holder }})
            </p>
          </div>
        </div>
        <div class="text-right bg-white/10 backdrop-blur-xs rounded-xl px-4 py-2.5 border border-white/15">
          <div class="text-[11px] text-emerald-300 font-semibold uppercase">ประจำงวดเดือน</div>
          <div class="text-xl font-extrabold">{{ dashboard?.month || 'พฤศจิกายน' }} {{ dashboard?.year_be || 2569 }}</div>
          <div class="text-[10px] text-slate-300">พิมพ์เมื่อ: {{ currentDateStr }}</div>
        </div>
      </div>

      <!-- 2. 4 Vibrant Executive KPI Cards -->
      <div class="grid grid-cols-4 gap-3">
        <!-- Total Income -->
        <div class="rounded-2xl p-3.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
          <div class="flex items-center justify-between text-[11px] font-bold opacity-90">
            <span>รายรับรวมประจำเดือน</span>
            <span class="text-base">💰</span>
          </div>
          <div class="text-2xl font-extrabold mt-1">
            ฿{{ formatNumber(ms.total_income || ms.total_revenue || 0) }}
          </div>
          <div class="text-[10px] mt-1 opacity-90 flex justify-between">
            <span>บิลค่าเช่า {{ ms.invoice_count || 0 }} ห้อง</span>
            <span>หักมัดจำ ฿{{ formatNumber(ms.deposit_deductions || 0) }}</span>
          </div>
        </div>

        <!-- Total Expenses (Direct + Hidden) -->
        <div class="rounded-2xl p-3.5 bg-gradient-to-br from-rose-500 to-orange-600 text-white shadow-sm">
          <div class="flex items-center justify-between text-[11px] font-bold opacity-90">
            <span>รายจ่าย &amp; ต้นทุนแฝงรวม</span>
            <span class="text-base">🛠️</span>
          </div>
          <div class="text-2xl font-extrabold mt-1">
            ฿{{ formatNumber(ms.total_expenses || 0) }}
          </div>
          <div class="text-[10px] mt-1 opacity-90 flex justify-between">
            <span>ทางตรง: ฿{{ formatNumber(ms.direct_expenses || 0) }}</span>
            <span>แฝง: ฿{{ formatNumber(ms.hidden_expenses || 0) }}</span>
          </div>
        </div>

        <!-- Net Profit & Margin -->
        <div class="rounded-2xl p-3.5 bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-sm">
          <div class="flex items-center justify-between text-[11px] font-bold opacity-90">
            <span>กำไรสุทธิ (Net Profit)</span>
            <span class="text-base">💎</span>
          </div>
          <div class="text-2xl font-extrabold mt-1">
            ฿{{ formatNumber(ms.net_profit ?? (ms.total_revenue || 0)) }}
          </div>
          <div class="text-[10px] mt-1 opacity-90 flex justify-between">
            <span>อัตรากำไรสุทธิ:</span>
            <span class="font-bold bg-white/20 px-1.5 rounded">{{ ms.profit_margin ?? 100 }}%</span>
          </div>
        </div>

        <!-- Occupancy & Tenants -->
        <div class="rounded-2xl p-3.5 bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 shadow-sm">
          <div class="flex items-center justify-between text-[11px] font-bold">
            <span>อัตราการเข้าพัก (Occupancy)</span>
            <span class="text-base">🔑</span>
          </div>
          <div class="text-2xl font-extrabold mt-1">
            {{ dashboard?.occupancy_rate || 100 }}%
            <span class="text-xs font-bold">({{ dashboard?.occupied_rooms || 0 }}/{{ dashboard?.total_rooms || 0 }} ห้อง)</span>
          </div>
          <div class="text-[10px] mt-1 font-semibold flex justify-between">
            <span>ผู้เช่า {{ dashboard?.active_tenants || 0 }} สัญญา</span>
            <span>รวม {{ dashboard?.total_occupants || 0 }} คน</span>
          </div>
        </div>
      </div>

      <!-- 3. Revenue vs Cost Composition & Utility Profit Margin -->
      <div class="grid grid-cols-12 gap-3.5">
        <!-- Left 7 cols: Revenue Structure & Zone Performance -->
        <div class="col-span-7 rounded-2xl border border-slate-200 p-4 bg-slate-50/60 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>โครงสร้างรายได้ค่าเช่าและสาธารณูปโภค ({{ dashboard?.month }})</span>
            </h3>
            <span class="text-xs font-bold text-emerald-700">รวม ฿{{ formatNumber(ms.total_revenue || 0) }}</span>
          </div>

          <!-- Stacked Progress Bar -->
          <div class="w-full h-4 rounded-full bg-slate-200 overflow-hidden flex shadow-inner">
            <div
              class="bg-indigo-600 h-full transition-all"
              :style="{ width: revPct(ms.room_revenue) + '%' }"
              title="ค่าเช่าห้อง"
            ></div>
            <div
              class="bg-amber-500 h-full transition-all"
              :style="{ width: revPct(ms.electric_revenue) + '%' }"
              title="ค่าไฟฟ้า"
            ></div>
            <div
              class="bg-sky-500 h-full transition-all"
              :style="{ width: revPct(ms.water_revenue) + '%' }"
              title="ค่าน้ำประปา"
            ></div>
          </div>

          <!-- Legend Pillars -->
          <div class="grid grid-cols-3 gap-2 text-xs">
            <div class="bg-white p-2.5 rounded-xl border border-slate-200">
              <div class="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
                <span class="w-2.5 h-2.5 rounded-xs bg-indigo-600"></span>
                <span>ค่าเช่าห้องพัก ({{ revPct(ms.room_revenue) }}%)</span>
              </div>
              <div class="text-base font-extrabold text-slate-900 mt-0.5">฿{{ formatNumber(ms.room_revenue || 0) }}</div>
              <div class="text-[10px] text-slate-400">ก่อนหักมัดจำ ฿{{ formatNumber(ms.deposit_deductions || 0) }}</div>
            </div>

            <div class="bg-white p-2.5 rounded-xl border border-slate-200">
              <div class="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
                <span class="w-2.5 h-2.5 rounded-xs bg-amber-500"></span>
                <span>รายรับค่าไฟ ({{ revPct(ms.electric_revenue) }}%)</span>
              </div>
              <div class="text-base font-extrabold text-amber-600 mt-0.5">฿{{ formatNumber(ms.electric_revenue || 0) }}</div>
              <div class="text-[10px] text-slate-400">ใช้ไฟรวม {{ formatNumber(ms.electric_units || 0) }} หน่วย</div>
            </div>

            <div class="bg-white p-2.5 rounded-xl border border-slate-200">
              <div class="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold">
                <span class="w-2.5 h-2.5 rounded-xs bg-sky-500"></span>
                <span>รายรับค่าน้ำ ({{ revPct(ms.water_revenue) }}%)</span>
              </div>
              <div class="text-base font-extrabold text-sky-600 mt-0.5">฿{{ formatNumber(ms.water_revenue || 0) }}</div>
              <div class="text-[10px] text-slate-400">มิเตอร์ {{ ms.water_units || 0 }} หน่วย + เหมา</div>
            </div>
          </div>

          <!-- Zone Breakdown Visual Bars -->
          <div class="pt-1 space-y-2">
            <div class="text-[11px] font-bold text-slate-600 uppercase">ประสิทธิภาพรายรับแยกตามโซนห้องพัก</div>
            <div
              v-for="(z, idx) in dashboard?.by_zone || []"
              :key="z.zone"
              class="bg-white px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between gap-3"
            >
              <div class="min-w-[125px]">
                <div class="text-xs font-bold text-slate-900">{{ z.zone }}</div>
                <div class="text-[10px] text-slate-500">เข้าพัก {{ z.occupied_count }}/{{ z.room_count }} ห้อง • ไฟ {{ z.electric_units || 0 }} หน่วย</div>
              </div>
              <div class="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full"
                  :class="idx === 0 ? 'bg-emerald-500' : (idx === 1 ? 'bg-indigo-500' : 'bg-amber-500')"
                  :style="{ width: zonePct(z.revenue) + '%' }"
                ></div>
              </div>
              <div class="text-right min-w-[75px]">
                <div class="text-xs font-extrabold text-slate-900">฿{{ formatNumber(z.revenue) }}</div>
                <div class="text-[10px] text-slate-400">{{ zonePct(z.revenue) }}%</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right 5 cols: Expense & Hidden Cost Breakdown + Utility Spread -->
        <div class="col-span-5 rounded-2xl border border-slate-200 p-4 bg-rose-50/30 flex flex-col justify-between">
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                <span>การวิเคราะห์ต้นทุนซ่อมบำรุง &amp; ค่าใช้จ่ายแฝง</span>
              </h3>
              <span class="text-xs font-bold text-rose-600">฿{{ formatNumber(ms.total_expenses || 0) }}</span>
            </div>

            <div class="space-y-1.5">
              <div
                v-for="cat in dashboard?.expense_by_category || []"
                :key="cat.category"
                class="bg-white px-3 py-2 rounded-xl border border-rose-100 flex items-center justify-between text-xs"
              >
                <div class="pr-2">
                  <div class="font-bold text-slate-800 leading-tight">{{ cat.category }}</div>
                  <span
                    class="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded font-semibold"
                    :class="cat.cost_nature === 'hidden' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'"
                  >
                    {{ cat.cost_nature === 'hidden' ? 'ค่าใช้จ่ายแฝง (Hidden Cost)' : 'ต้นทุนทางตรง/ซ่อมบำรุง' }}
                  </span>
                </div>
                <div class="text-right shrink-0">
                  <div class="font-extrabold text-rose-600">฿{{ formatNumber(cat.amount) }}</div>
                  <div class="text-[10px] text-slate-400">{{ cat.count }} รายการ</div>
                </div>
              </div>
              <div v-if="!(dashboard?.expense_by_category?.length)" class="text-center py-6 text-xs text-slate-400">
                ไม่มีรายการค่าใช้จ่ายในเดือนนี้
              </div>
            </div>
          </div>

          <!-- Utility Cost vs Collection Box -->
          <div class="mt-3 p-3 rounded-xl bg-slate-900 text-white text-xs space-y-1">
            <div class="font-bold text-amber-300 flex items-center justify-between">
              <span>⚡💧 ส่วนต่างสาธารณูปโภค (เก็บจากผู้เช่า vs ต้นทุนจริง)</span>
            </div>
            <div class="flex justify-between text-[11px] text-slate-300">
              <span>เก็บค่าน้ำ+ไฟจากผู้เช่ารวม:</span>
              <span class="font-bold text-white">฿{{ formatNumber((ms.water_revenue || 0) + (ms.electric_revenue || 0)) }}</span>
            </div>
            <div class="flex justify-between text-[11px] text-slate-300">
              <span>ต้นทุนการไฟฟ้า/ประปาส่วนกลาง:</span>
              <span class="font-bold text-rose-300">-฿{{ formatNumber(ms.utility_cost_expenses || 0) }}</span>
            </div>
            <div class="flex justify-between text-xs font-extrabold text-emerald-400 pt-1 border-t border-slate-700">
              <span>ส่วนต่างชดเชยไฟส่วนกลาง/ปั๊มน้ำ:</span>
              <span>+฿{{ formatNumber((ms.water_revenue || 0) + (ms.electric_revenue || 0) - (ms.utility_cost_expenses || 0)) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Bottom Section: Top 5 Electric Usage Rooms & Monthly Accounting Ledger Summary -->
      <div class="grid grid-cols-12 gap-3.5">
        <!-- Top 5 Electric Rooms -->
        <div class="col-span-5 rounded-2xl border border-slate-200 p-3.5 bg-white">
          <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
            ⚡ 5 อันดับห้องที่ใช้ไฟฟ้าสูงสุดประจำเดือน ({{ dashboard?.month }})
          </h3>
          <table class="w-full text-[11px] border-collapse">
            <thead>
              <tr class="border-b border-slate-200 text-slate-400 text-left">
                <th class="py-1">ห้อง</th>
                <th class="py-1">ผู้เช่า</th>
                <th class="py-1 text-right">หน่วยไฟ</th>
                <th class="py-1 text-right">ค่าไฟ</th>
                <th class="py-1 text-right">รวมบิล</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(rm, i) in dashboard?.top_electric_rooms || []" :key="rm.room_number">
                <td class="py-1.5 font-bold text-slate-900">
                  <span class="inline-block w-4 text-center rounded bg-amber-100 text-amber-800 mr-1">{{ i + 1 }}</span>
                  {{ rm.room_number }}
                </td>
                <td class="py-1.5 text-slate-700">{{ rm.tenant_name }}</td>
                <td class="py-1.5 text-right font-semibold text-amber-700">{{ rm.electric_units }} หน่วย</td>
                <td class="py-1.5 text-right">฿{{ formatNumber(rm.electric_total) }}</td>
                <td class="py-1.5 text-right font-bold text-emerald-700">฿{{ formatNumber(rm.total_amount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Accounting Transactions Snapshot -->
        <div class="col-span-7 rounded-2xl border border-slate-200 p-3.5 bg-white">
          <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
            📋 รายการซ่อมบำรุงและค่าใช้จ่ายสำคัญประจำเดือน ({{ (dashboard?.month_accounting || []).length }} รายการ)
          </h3>
          <table class="w-full text-[11px] border-collapse">
            <thead>
              <tr class="border-b border-slate-200 text-slate-400 text-left">
                <th class="py-1">วันที่</th>
                <th class="py-1">หมวดหมู่</th>
                <th class="py-1">รายการ</th>
                <th class="py-1 text-center">ห้อง/โซน</th>
                <th class="py-1 text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="tx in (dashboard?.month_accounting || []).slice(0, 6)" :key="tx.id">
                <td class="py-1 text-slate-500 whitespace-nowrap">{{ tx.tx_date }}</td>
                <td class="py-1">
                  <span
                    class="px-1.5 py-0.2 rounded text-[10px] font-semibold"
                    :class="tx.cost_nature === 'hidden' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800'"
                  >
                    {{ tx.cost_nature === 'hidden' ? 'แฝง' : 'ทางตรง' }}
                  </span>
                </td>
                <td class="py-1 font-medium text-slate-800 truncate max-w-[210px]">{{ tx.title }}</td>
                <td class="py-1 text-center font-semibold text-slate-600">{{ tx.room_number || 'ส่วนกลาง' }}</td>
                <td class="py-1 text-right font-bold" :class="tx.tx_type === 'income' ? 'text-emerald-600' : 'text-rose-600'">
                  {{ tx.tx_type === 'income' ? '+' : '-' }}฿{{ formatNumber(tx.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 5. Executive Signature & Summary Footer -->
    <div class="pt-3 border-t border-slate-200 flex items-end justify-between text-xs text-slate-500">
      <div>
        <div class="font-bold text-slate-800">
          สรุปสถานะการเงินประจำเดือน {{ dashboard?.month }} {{ dashboard?.year_be }}:
          <span class="text-emerald-600">กำไรสุทธิ ฿{{ formatNumber(ms.net_profit ?? (ms.total_revenue || 0)) }}</span>
        </div>
        <div class="text-[10px]">
          เอกสารอินโฟกราฟิกฉบับนี้สร้างโดยระบบบริหารจัดการหอพักอัตโนมัติ (อ้างอิงฐานข้อมูลจริงจาก Supabase)
        </div>
      </div>
      <div class="flex gap-10 text-center text-[11px]">
        <div>
          <div class="w-36 border-b border-dotted border-slate-400 mb-1">&nbsp;</div>
          <div>ผู้จัดทำรายงาน / แอดมิน</div>
        </div>
        <div>
          <div class="w-36 border-b border-dotted border-slate-400 mb-1">&nbsp;</div>
          <div>({{ settings?.account_holder || 'นาง เอมอร ไทยนอ' }})</div>
          <div class="text-[10px] text-slate-400">เจ้าของหอพัก / ผู้บริหาร</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { formatNumber } from '../utils/bahtText.js';

const props = defineProps({
  dashboard: {
    type: Object,
    default: () => ({})
  },
  settings: {
    type: Object,
    default: () => ({})
  }
});

const ms = computed(() => props.dashboard?.monthly_summary || {});

const currentDateStr = computed(() => {
  return new Date().toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
});

function revPct(val) {
  const total = Number(ms.value.room_revenue || 0) + Number(ms.value.water_revenue || 0) + Number(ms.value.electric_revenue || 0);
  if (!total) return 0;
  return Math.round((Number(val || 0) / total) * 100);
}

function zonePct(val) {
  const total = Number(ms.value.total_revenue || 0);
  if (!total) return 0;
  return Math.round((Number(val || 0) / total) * 100);
}
</script>
