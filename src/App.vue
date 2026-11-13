<template>
  <div class="min-h-screen bg-slate-100 text-slate-800">
    <!-- Top Navigation Bar (Hidden when printing) -->
    <header class="no-print sticky top-0 z-30 bg-slate-900 text-white shadow-lg border-b border-slate-800">
      <div class="max-w-[1440px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <!-- Brand -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center font-bold text-lg shadow-inner">
            🏢
          </div>
          <div>
            <h1 class="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2">
              <span>{{ settings.dorm_name || 'ระบบบริหารจัดการหอพักครบวงจร' }}</span>
              <span class="text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                ERP &amp; Executive Suite
              </span>
            </h1>
            <p class="text-xs text-slate-400">
              ออกบิล A4 ครึ่งแผ่น • ทะเบียนประวัติลูกค้า/ย้ายห้อง • แดชบอร์ดอินโฟกราฟิก A4 • บัญชีรายรับ-รายจ่าย &amp; ต้นทุนแฝง
            </p>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <nav class="flex flex-wrap items-center gap-1 bg-slate-800/90 p-1.5 rounded-xl border border-slate-700">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer"
            :class="activeTab === tab.id
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'text-slate-300 hover:text-white hover:bg-slate-700/60'"
          >
            <span>{{ tab.icon }}</span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <!-- Quick Print Button -->
        <div class="flex items-center gap-2">
          <button
            v-if="['dashboard', 'monthly', 'daily', 'accounting'].includes(activeTab)"
            @click="triggerPrint"
            class="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow flex items-center gap-1.5 cursor-pointer transition"
          >
            <span>🖨️</span>
            <span>{{ printButtonLabel }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Toast Notification -->
    <div
      v-if="toast.show"
      class="no-print fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl border flex items-center gap-3 transition-all"
      :class="toast.type === 'error' ? 'bg-red-600 text-white border-red-500' : 'bg-slate-900 text-white border-emerald-500'"
    >
      <span>{{ toast.type === 'error' ? '⚠️' : '✅' }}</span>
      <span class="text-sm font-medium">{{ toast.message }}</span>
    </div>

    <!-- MAIN CONTENT CONTAINER -->
    <main class="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 print:p-0 print:m-0 print:max-w-none">
      <!-- ===================================================== -->
      <!-- TAB 1: EXECUTIVE DASHBOARD & A4 INFOGRAPHIC REPORT     -->
      <!-- ===================================================== -->
      <section v-if="activeTab === 'dashboard'" class="space-y-6">
        <!-- Period & View Mode Bar (Hidden on print) -->
        <div class="no-print bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                Owner &amp; Executive Dashboard
              </span>
            </div>
            <h2 class="text-xl font-bold text-slate-900 mt-1">
              📊 แดชบอร์ดผู้บริหารและรายงานอินโฟกราฟิกสรุปผลรายเดือน (ขนาดหน้า A4)
            </h2>
            <p class="text-sm text-slate-500">
              วิเคราะห์รายรับค่าเช่า ค่าน้ำ-ค่าไฟ ต้นทุนซ่อมบำรุง ค่าใช้จ่ายแฝง และกำไรสุทธิ พร้อมพิมพ์เป็นแผ่นอินโฟกราฟิก A4
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <!-- View switcher -->
            <div class="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                @click="dashViewMode = 'both'"
                class="px-3 py-1.5 rounded-lg cursor-pointer"
                :class="dashViewMode === 'both' ? 'bg-slate-900 text-white' : 'text-slate-600'"
              >
                แดชบอร์ด + อินโฟกราฟิก A4
              </button>
              <button
                @click="dashViewMode = 'infographic'"
                class="px-3 py-1.5 rounded-lg cursor-pointer"
                :class="dashViewMode === 'infographic' ? 'bg-indigo-600 text-white' : 'text-slate-600'"
              >
                📄 เฉพาะแผ่นอินโฟกราฟิก A4
              </button>
            </div>

            <div class="flex items-center gap-2">
              <label class="text-xs font-bold text-slate-600">เดือน:</label>
              <select
                v-model="dashFilter.month"
                @change="onDashPeriodChange"
                class="border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-bold bg-white"
              >
                <option v-for="m in thaiMonths" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <label class="text-xs font-bold text-slate-600">พ.ศ.:</label>
              <select
                v-model.number="dashFilter.year_be"
                @change="onDashPeriodChange"
                class="border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-bold bg-white"
              >
                <option v-for="y in [2568, 2569, 2570]" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <button
              @click="triggerPrint"
              class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
            >
              <span>🖨️</span>
              <span>พิมพ์อินโฟกราฟิก A4</span>
            </button>
          </div>
        </div>

        <!-- Colorful Interactive Executive Cards (Hidden on print so only the A4 Infographic prints) -->
        <div v-if="dashViewMode === 'both'" class="no-print space-y-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Card 1: Gross Revenue -->
            <div class="rounded-2xl p-5 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-md">
              <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-90">
                <span>รายรับรวมประจำเดือน ({{ dashFilter.month }})</span>
                <span class="text-2xl">💰</span>
              </div>
              <div class="text-3xl font-extrabold mt-2">
                ฿{{ formatNumber(dashboard.monthly_summary?.total_income || dashboard.monthly_summary?.total_revenue || 0) }}
              </div>
              <div class="mt-3 pt-2 border-t border-white/20 text-xs flex justify-between opacity-95">
                <span>ค่าเช่า+น้ำไฟ: ฿{{ formatNumber(dashboard.monthly_summary?.total_revenue || 0) }}</span>
                <span>{{ dashboard.monthly_summary?.invoice_count || 0 }} ห้อง</span>
              </div>
            </div>

            <!-- Card 2: Total Expenses & Hidden Costs -->
            <div class="rounded-2xl p-5 bg-gradient-to-br from-rose-500 via-rose-600 to-orange-600 text-white shadow-md">
              <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-90">
                <span>รายจ่ายซ่อมบำรุง &amp; ต้นทุนแฝง</span>
                <span class="text-2xl">🛠️</span>
              </div>
              <div class="text-3xl font-extrabold mt-2">
                ฿{{ formatNumber(dashboard.monthly_summary?.total_expenses || 0) }}
              </div>
              <div class="mt-3 pt-2 border-t border-white/20 text-xs flex justify-between opacity-95">
                <span>ทางตรง: ฿{{ formatNumber(dashboard.monthly_summary?.direct_expenses || 0) }}</span>
                <span>ต้นทุนแฝง: ฿{{ formatNumber(dashboard.monthly_summary?.hidden_expenses || 0) }}</span>
              </div>
            </div>

            <!-- Card 3: Net Profit -->
            <div class="rounded-2xl p-5 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white shadow-md">
              <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-90">
                <span>กำไรสุทธิเข้าบัญชี (Net Profit)</span>
                <span class="text-2xl">💎</span>
              </div>
              <div class="text-3xl font-extrabold mt-2">
                ฿{{ formatNumber(dashboard.monthly_summary?.net_profit ?? (dashboard.monthly_summary?.total_revenue || 0)) }}
              </div>
              <div class="mt-3 pt-2 border-t border-white/20 text-xs flex justify-between opacity-95">
                <span>อัตรากำไรสุทธิ (Margin):</span>
                <span class="font-extrabold bg-white/20 px-2 py-0.5 rounded-full">
                  {{ dashboard.monthly_summary?.profit_margin ?? 100 }}%
                </span>
              </div>
            </div>

            <!-- Card 4: Occupancy & Yearly Cumulative -->
            <div class="rounded-2xl p-5 bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-slate-950 shadow-md">
              <div class="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider">
                <span>อัตราเข้าพัก &amp; กำไรสะสมปี {{ dashFilter.year_be }}</span>
                <span class="text-2xl">🏆</span>
              </div>
              <div class="text-3xl font-extrabold mt-2">
                {{ dashboard.occupancy_rate || 100 }}%
                <span class="text-sm font-bold">({{ dashboard.occupied_rooms || 0 }}/{{ dashboard.total_rooms || 0 }} ห้อง)</span>
              </div>
              <div class="mt-3 pt-2 border-t border-slate-900/15 text-xs font-bold flex justify-between">
                <span>ผู้พักรวม {{ dashboard.total_occupants || 0 }} คน</span>
                <span>กำไรปีนี้ ฿{{ formatNumber(dashboard.yearly_summary?.net_profit || 0) }}</span>
              </div>
            </div>
          </div>

          <!-- Yearly Overview Table -->
          <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 overflow-x-auto">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-slate-900 text-base">
                📈 ตารางสรุปผลประกอบการรายเดือน ประจำปี พ.ศ. {{ dashFilter.year_be }} (รายรับ vs รายจ่าย vs กำไรสุทธิ)
              </h3>
              <button
                @click="activeTab = 'accounting'"
                class="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                จัดการรายการซ่อมบำรุงและต้นทุนแฝง →
              </button>
            </div>
            <table class="w-full text-xs sm:text-sm text-left border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-slate-500 text-xs uppercase bg-slate-50">
                  <th class="py-2.5 px-3">เดือน</th>
                  <th class="py-2.5 px-3 text-center">จำนวนบิล</th>
                  <th class="py-2.5 px-3 text-right">ค่าห้อง</th>
                  <th class="py-2.5 px-3 text-right">ค่าน้ำ+ค่าไฟ</th>
                  <th class="py-2.5 px-3 text-right font-bold text-emerald-700">รวมรายรับ</th>
                  <th class="py-2.5 px-3 text-right text-rose-600">ซ่อมบำรุง/ทางตรง</th>
                  <th class="py-2.5 px-3 text-right text-purple-600">ค่าใช้จ่ายแฝง</th>
                  <th class="py-2.5 px-3 text-right font-extrabold text-indigo-700">กำไรสุทธิ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="row in dashboard.by_month"
                  :key="row.month"
                  class="hover:bg-slate-50 transition"
                  :class="{ 'bg-emerald-50/70 font-semibold': row.month === dashFilter.month && (row.invoice_count > 0 || row.total_expenses > 0) }"
                >
                  <td class="py-2 px-3">{{ row.month }}</td>
                  <td class="py-2 px-3 text-center">
                    <span v-if="row.invoice_count > 0" class="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                      {{ row.invoice_count }} ใบ
                    </span>
                    <span v-else class="text-slate-300">-</span>
                  </td>
                  <td class="py-2 px-3 text-right">{{ row.room_revenue ? formatNumber(row.room_revenue) : '-' }}</td>
                  <td class="py-2 px-3 text-right text-sky-700">
                    {{ (row.water_revenue + row.electric_revenue) ? formatNumber(row.water_revenue + row.electric_revenue) : '-' }}
                  </td>
                  <td class="py-2 px-3 text-right font-bold text-emerald-700">
                    {{ row.total_income ? `฿${formatNumber(row.total_income)}` : '-' }}
                  </td>
                  <td class="py-2 px-3 text-right text-rose-600">
                    {{ row.direct_expenses ? `-฿${formatNumber(row.direct_expenses)}` : '-' }}
                  </td>
                  <td class="py-2 px-3 text-right text-purple-600">
                    {{ row.hidden_expenses ? `-฿${formatNumber(row.hidden_expenses)}` : '-' }}
                  </td>
                  <td class="py-2 px-3 text-right font-extrabold text-indigo-700">
                    {{ (row.total_income || row.total_expenses) ? `฿${formatNumber(row.net_profit)}` : '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- PRINTABLE A4 EXECUTIVE INFOGRAPHIC SHEET -->
        <div class="print-area">
          <div class="no-print text-center mb-3">
            <span class="inline-block bg-gradient-to-r from-indigo-600 to-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow">
              🎨 แผ่นรายงานอินโฟกราฟิกผู้บริหารขนาดมาตรฐาน A4 (สั่งพิมพ์ออกกระดาษ A4 หรือบันทึกเป็น PDF ได้ทันที)
            </span>
          </div>
          <ExecutiveInfographicA4 :dashboard="dashboard" :settings="settings" />
        </div>
      </section>

      <!-- ===================================================== -->
      <!-- TAB 2: MONTHLY BATCH BILLING (ออกบิลรายเดือนชุดเดียว)   -->
      <!-- ===================================================== -->
      <section v-if="activeTab === 'monthly'">
        <!-- Control Bar (Hidden when printing) -->
        <div class="no-print space-y-5 mb-8">
          <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <div class="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 class="text-xl font-bold text-slate-900">
                  🧾 ออกบิลลูกค้ารายเดือน (คำนวณมิเตอร์ &amp; พิมพ์เอกสารชุดเดียว 29 ห้อง)
                </h2>
                <p class="text-sm text-slate-500">
                  ค่าน้ำ: คิดตามมิเตอร์ (หลังจด - ก่อนจด × เรท) หรือเหมาจ่ายรายคน (100 บาท/คน) • ค่าไฟ: คิดตามมิเตอร์ × เรทค่าไฟ • รองรับการหักค่ามัดจำ/ย้ายออก
                </p>
              </div>

              <!-- Period & Date Controls -->
              <div class="flex flex-wrap items-center gap-2.5">
                <div class="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span class="text-xs font-semibold text-slate-600">วันที่ในบิล:</span>
                  <input v-model="batchPeriod.doc_day" class="w-10 text-center font-bold bg-white border border-slate-300 rounded px-1 py-0.5 text-sm" />
                  <span class="text-xs font-semibold text-slate-600">เดือน:</span>
                  <select v-model="batchPeriod.billing_month" @change="onChangeBatchPeriod" class="bg-white border border-slate-300 rounded px-2 py-0.5 text-sm font-bold">
                    <option v-for="m in thaiMonths" :key="m" :value="m">{{ m }}</option>
                  </select>
                  <span class="text-xs font-semibold text-slate-600">พ.ศ.:</span>
                  <input v-model.number="batchPeriod.billing_year_be" @change="onChangeBatchPeriod" type="number" class="w-20 text-center font-bold bg-white border border-slate-300 rounded px-1 py-0.5 text-sm" />
                </div>

                <button
                  @click="carryOverMetersForNewMonth"
                  class="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition"
                  title="ดึงเลขมิเตอร์หลังจดล่าสุดมาเป็นเลขมิเตอร์จดครั้งก่อนสำหรับรอบบิลใหม่"
                >
                  🔄 ดึงมิเตอร์ล่าสุดตั้งต้นรอบใหม่
                </button>

                <button
                  @click="saveAllMonthlyInvoices"
                  :disabled="savingBatch"
                  class="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer transition flex items-center gap-1.5"
                >
                  <span>💾</span>
                  <span>{{ savingBatch ? 'กำลังบันทึก...' : 'บันทึกบิลทั้งชุดลงฐานข้อมูล & เก็บ Log' }}</span>
                </button>

                <button
                  @click="triggerPrint"
                  class="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer transition flex items-center gap-1.5"
                >
                  <span>🖨️</span>
                  <span>พิมพ์เอกสารชุดเดียว ({{ monthlyA4Sheets.length }} หน้า A4)</span>
                </button>
              </div>
            </div>

            <!-- View Mode Toggle & Filter -->
            <div class="flex flex-wrap items-center justify-between gap-4 pt-4">
              <div class="flex items-center gap-2">
                <button
                  @click="monthlyViewMode = 'split'"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  :class="monthlyViewMode === 'split' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'"
                >
                  ตารางกรอกมิเตอร์ + ตัวอย่างใบเสร็จ A4
                </button>
                <button
                  @click="monthlyViewMode = 'table'"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  :class="monthlyViewMode === 'table' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'"
                >
                  เฉพาะตารางกรอกมิเตอร์
                </button>
                <button
                  @click="monthlyViewMode = 'preview'"
                  class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  :class="monthlyViewMode === 'preview' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'"
                >
                  เฉพาะตัวอย่างกระดาษ A4 (พร้อมแก้ไขบนบิลโดยตรง)
                </button>
              </div>

              <div class="flex items-center gap-3 text-xs">
                <label class="flex items-center gap-1.5 font-semibold text-amber-800 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 cursor-pointer">
                  <input type="checkbox" v-model="directEditOnReceipt" class="rounded" />
                  <span>✏️ เปิดโหมดคลิกแก้ไขข้อความบนใบเสร็จโดยตรง</span>
                </label>
                <span class="font-semibold text-slate-600">
                  เลือกพิมพ์: {{ selectedMonthlyInvoices.length }} / {{ monthlyDrafts.length }} ห้อง
                  (ยอดรวมชุดนี้: <strong class="text-emerald-600 text-sm">฿{{ formatNumber(totalMonthlyBatchAmount) }}</strong>)
                </span>
              </div>
            </div>
          </div>

          <!-- Meter Entry Spreadsheet Table -->
          <div v-if="monthlyViewMode !== 'preview'" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-800 text-white text-left">
                    <th class="p-2.5 text-center w-8">
                      <input type="checkbox" :checked="allMonthlySelected" @change="toggleSelectAllMonthly" />
                    </th>
                    <th class="p-2.5">ห้อง</th>
                    <th class="p-2.5">ชื่อผู้เช่า</th>
                    <th class="p-2.5 text-right">ค่าห้อง</th>
                    <th class="p-2.5 text-center">วิธีคิดน้ำ</th>
                    <th class="p-2.5 text-center bg-sky-950/60">น้ำ (ก่อน)</th>
                    <th class="p-2.5 text-center bg-sky-950/60">น้ำ (หลัง)</th>
                    <th class="p-2.5 text-center bg-sky-950/60">หน่วย/คน</th>
                    <th class="p-2.5 text-right bg-sky-950/60">รวมน้ำ</th>
                    <th class="p-2.5 text-center bg-amber-950/60">ไฟ (ก่อน)</th>
                    <th class="p-2.5 text-center bg-amber-950/60">ไฟ (หลัง)</th>
                    <th class="p-2.5 text-center bg-amber-950/60">หน่วยไฟ</th>
                    <th class="p-2.5 text-center bg-amber-950/60">เรทไฟ</th>
                    <th class="p-2.5 text-right bg-amber-950/60">รวมไฟ</th>
                    <th class="p-2.5">ค่าอื่นๆ / หักมัดจำ / ย้ายออก</th>
                    <th class="p-2.5 text-right">รวมสุทธิ (บาท)</th>
                    <th class="p-2.5 text-center">พิมพ์เดี่ยว</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  <tr
                    v-for="(item, idx) in monthlyDrafts"
                    :key="item.room_number + idx"
                    class="hover:bg-slate-50 transition"
                    :class="{ 'bg-rose-50/60': item.is_move_out }"
                  >
                    <td class="p-2 text-center">
                      <input type="checkbox" v-model="item.selected" />
                    </td>
                    <td class="p-2 font-bold text-slate-900 whitespace-nowrap">{{ item.room_number }}</td>
                    <td class="p-2">
                      <input
                        v-model="item.tenant_name"
                        class="w-28 border border-slate-300 rounded px-2 py-1 text-xs font-medium bg-white"
                      />
                    </td>
                    <td class="p-2 text-right">
                      <input
                        v-model.number="item.room_rate"
                        @input="recalculateRow(item)"
                        type="number"
                        class="w-20 text-right border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold bg-white"
                      />
                    </td>
                    <td class="p-2 text-center">
                      <select
                        v-model="item.water_calc_type"
                        @change="recalculateRow(item)"
                        class="border border-slate-300 rounded px-1.5 py-1 text-xs bg-white"
                      >
                        <option value="meter">มิเตอร์ ({{ item.water_unit_price || 10 }}บ.)</option>
                        <option value="per_person">เหมา/หัว (100บ.)</option>
                        <option value="flat">เหมาคงที่</option>
                      </select>
                    </td>
                    <!-- Water Prev -->
                    <td class="p-2 text-center bg-sky-50/40">
                      <input
                        v-if="item.water_calc_type === 'meter'"
                        v-model="item.water_prev"
                        @input="recalculateRow(item)"
                        class="w-16 text-center border border-sky-300 rounded px-1 py-1 text-xs bg-white"
                        placeholder="ก่อนจด"
                      />
                      <span v-else class="text-slate-300">-</span>
                    </td>
                    <!-- Water Curr -->
                    <td class="p-2 text-center bg-sky-50/40">
                      <input
                        v-if="item.water_calc_type === 'meter'"
                        v-model="item.water_curr"
                        @input="recalculateRow(item)"
                        class="w-16 text-center border border-sky-300 rounded px-1 py-1 text-xs font-semibold bg-white"
                        placeholder="หลังจด"
                      />
                      <span v-else class="text-slate-300">-</span>
                    </td>
                    <!-- Water Units or Occupants -->
                    <td class="p-2 text-center bg-sky-50/40">
                      <span v-if="item.water_calc_type === 'meter'" class="font-semibold text-sky-700">
                        {{ item.water_units }} หน่วย
                      </span>
                      <div v-else-if="item.water_calc_type === 'per_person'" class="flex items-center justify-center gap-1">
                        <input
                          v-model.number="item.occupant_count"
                          @input="recalculateRow(item)"
                          type="number"
                          min="1"
                          class="w-12 text-center border border-sky-300 rounded px-1 py-0.5 text-xs bg-white"
                        />
                        <span class="text-[11px] text-slate-500">คน</span>
                      </div>
                      <span v-else class="text-slate-400">เหมา</span>
                    </td>
                    <!-- Water Total -->
                    <td class="p-2 text-right bg-sky-50/40">
                      <input
                        v-model.number="item.water_total"
                        @input="recalculateTotalOnly(item)"
                        type="number"
                        class="w-16 text-right border border-sky-300 rounded px-1.5 py-1 text-xs font-bold text-sky-700 bg-white"
                      />
                    </td>

                    <!-- Electric Prev -->
                    <td class="p-2 text-center bg-amber-50/40">
                      <input
                        v-model="item.electric_prev"
                        @input="recalculateRow(item)"
                        class="w-16 text-center border border-amber-300 rounded px-1 py-1 text-xs bg-white"
                      />
                    </td>
                    <!-- Electric Curr -->
                    <td class="p-2 text-center bg-amber-50/40">
                      <input
                        v-model="item.electric_curr"
                        @input="recalculateRow(item)"
                        class="w-16 text-center border border-amber-300 rounded px-1 py-1 text-xs font-semibold bg-white"
                      />
                    </td>
                    <!-- Electric Units -->
                    <td class="p-2 text-center bg-amber-50/40 font-semibold text-amber-800">
                      {{ item.electric_units }}
                    </td>
                    <!-- Electric Rate -->
                    <td class="p-2 text-center bg-amber-50/40">
                      <input
                        v-model.number="item.electric_unit_price"
                        @input="recalculateRow(item)"
                        type="number"
                        class="w-12 text-center border border-amber-300 rounded px-1 py-1 text-xs bg-white"
                      />
                    </td>
                    <!-- Electric Total -->
                    <td class="p-2 text-right bg-amber-50/40 font-bold text-amber-700">
                      {{ formatNumber(item.electric_total) }}
                    </td>

                    <!-- Other / Deposit Deduction -->
                    <td class="p-2">
                      <div class="flex items-center gap-1">
                        <input
                          v-model="item.other_description"
                          class="w-36 border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                          placeholder="เช่น หักค่ามัดจำ  2500"
                        />
                        <button
                          @click="toggleMoveOutDeduction(item)"
                          class="px-2 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer border"
                          :class="item.is_move_out
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-rose-50 hover:text-rose-600'"
                        >
                          {{ item.is_move_out ? '✓ หักมัดจำ 2500' : 'หักมัดจำ' }}
                        </button>
                      </div>
                    </td>

                    <!-- Net Total -->
                    <td class="p-2 text-right">
                      <input
                        v-model.number="item.total_amount"
                        type="number"
                        class="w-20 text-right font-extrabold text-emerald-700 border border-emerald-400 rounded px-1.5 py-1 text-xs bg-emerald-50/50"
                      />
                    </td>

                    <!-- Action -->
                    <td class="p-2 text-center">
                      <button
                        @click="openSingleInDailyEditor(item)"
                        class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                      >
                        แก้ไขแยกใบ
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- PRINTABLE A4 SHEETS (2 Half-A4 Receipts Per A4 Page, Top & Bottom) -->
        <div v-if="monthlyViewMode !== 'table'" class="print-area">
          <div class="no-print text-center mb-4">
            <span class="inline-block bg-slate-800 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow">
              📄 ตัวอย่างเอกสารรีพอร์ต A4 (1 แผ่น A4 = 2 ใบเสร็จครึ่งแผ่น บน-ล่าง ตรงตามต้นฉบับ 100%)
            </span>
          </div>

          <div
            v-for="(sheet, sIdx) in monthlyA4Sheets"
            :key="'sheet-' + sIdx"
            class="a4-sheet"
          >
            <ReceiptHalfA4
              :doc="sheet.top"
              :settings="settings"
              :editable="directEditOnReceipt"
              @update:doc="(val) => Object.assign(sheet.top, val)"
            />
            <div class="receipt-divider"></div>
            <ReceiptHalfA4
              :doc="sheet.bottom"
              :settings="settings"
              :editable="directEditOnReceipt"
              @update:doc="(val) => Object.assign(sheet.bottom, val)"
            />
          </div>
        </div>
      </section>

      <!-- ===================================================== -->
      <!-- TAB 3: DAILY / CUSTOM / BLANK RECEIPT                 -->
      <!-- ===================================================== -->
      <section v-if="activeTab === 'daily'">
        <div class="no-print bg-white rounded-2xl p-5 shadow-sm border border-slate-200 mb-6 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 class="text-xl font-bold text-slate-900">
                📝 ออกใบเสร็จลูกค้ารายวัน / แก้ไขข้อความอิสระ / พิมพ์แบบฟอร์มเปล่าครึ่ง A4
              </h2>
              <p class="text-sm text-slate-500">
                ดึงข้อมูลห้องพักอัตโนมัติ หรือพิมพ์แก้ไขข้อความเองทุกบรรทัด (กรณีพักรายวัน, หักค่ามัดจำ, ย้ายออก, ปรับปรุงยอด)
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2.5">
              <button
                @click="saveCustomDailyReceipts"
                class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
              >
                <span>💾</span>
                <span>บันทึกใบเสร็จรายวัน/กำหนดเองลงระบบ</span>
              </button>
              <button
                @click="triggerPrint"
                class="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
              >
                <span>🖨️</span>
                <span>พิมพ์ใบเสร็จ A4 นี้ทันที</span>
              </button>
            </div>
          </div>

          <!-- Dual Editor Controls (Top Receipt & Bottom Receipt on the single A4 page) -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Top Half Configuration -->
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900 text-sm">🔼 ใบเสร็จครึ่งบน (Top Half-A4)</span>
                <div class="flex items-center gap-2">
                  <button
                    @click="setCustomSlotMode('top', 'daily')"
                    class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer"
                    :class="!customPair.top.is_blank ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-700'"
                  >
                    กรอกอัตโนมัติ / แก้ไขเอง
                  </button>
                  <button
                    @click="setCustomSlotMode('top', 'blank')"
                    class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer"
                    :class="customPair.top.is_blank ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-700'"
                  >
                    แบบฟอร์มเปล่า (จุดไข่ปลา)
                  </button>
                </div>
              </div>

              <div v-if="!customPair.top.is_blank" class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label class="font-semibold text-slate-600 block mb-1">เลือกห้องพัก (ดึงอัตโนมัติ):</label>
                  <select @change="onSelectRoomForCustom('top', $event.target.value)" class="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                    <option value="">-- พิมพ์เองอิสระ --</option>
                    <option v-for="r in rooms" :key="r.id" :value="r.room_number">
                      ห้อง {{ r.room_number }} ({{ r.active_tenant?.name || 'ว่าง' }})
                    </option>
                  </select>
                </div>
                <div>
                  <label class="font-semibold text-slate-600 block mb-1">ประเภทการเช่า:</label>
                  <select v-model="customPair.top.invoice_type" @change="onCustomTypeChange('top')" class="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                    <option value="daily">ลูกค้ารายวัน</option>
                    <option value="monthly">ลูกค้ารายเดือน</option>
                    <option value="custom">กำหนดเอง (หักมัดจำ/ย้ายออก)</option>
                  </select>
                </div>
                <div v-if="customPair.top.invoice_type === 'daily'">
                  <label class="font-semibold text-slate-600 block mb-1">จำนวนวัน × เรทรายวัน:</label>
                  <div class="flex items-center gap-1">
                    <input v-model.number="customPair.top.days_count" @input="calcDailyCustom('top')" type="number" min="1" class="w-14 border border-slate-300 rounded px-1.5 py-1 bg-white text-center" />
                    <span>×</span>
                    <input v-model.number="customPair.top.daily_rate" @input="calcDailyCustom('top')" type="number" class="w-20 border border-slate-300 rounded px-1.5 py-1 bg-white text-right" />
                  </div>
                </div>
                <div class="col-span-2 sm:col-span-3 flex flex-wrap gap-2 pt-1">
                  <button @click="applyMoveOutTemplate('top')" class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-semibold hover:bg-rose-200 cursor-pointer">
                    + กรณีหักค่ามัดจำ 2,500 บาท (ย้ายออก)
                  </button>
                  <button @click="applyDailyTemplate('top')" class="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-lg font-semibold hover:bg-sky-200 cursor-pointer">
                    + ตั้งค่าเริ่มต้นลูกค้ารายวัน
                  </button>
                </div>
              </div>
            </div>

            <!-- Bottom Half Configuration -->
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900 text-sm">🔽 ใบเสร็จครึ่งล่าง (Bottom Half-A4)</span>
                <div class="flex items-center gap-2">
                  <button
                    @click="setCustomSlotMode('bottom', 'daily')"
                    class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer"
                    :class="!customPair.bottom.is_blank ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-700'"
                  >
                    กรอกอัตโนมัติ / แก้ไขเอง
                  </button>
                  <button
                    @click="setCustomSlotMode('bottom', 'blank')"
                    class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer"
                    :class="customPair.bottom.is_blank ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300 text-slate-700'"
                  >
                    แบบฟอร์มเปล่า (เหมือนต้นฉบับหน้า 1 ล่าง)
                  </button>
                  <button
                    @click="copyTopToBottom"
                    class="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer"
                  >
                    คัดลอกจากด้านบน (ต้นฉบับ+สำเนา)
                  </button>
                </div>
              </div>

              <div v-if="!customPair.bottom.is_blank" class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label class="font-semibold text-slate-600 block mb-1">เลือกห้องพัก (ดึงอัตโนมัติ):</label>
                  <select @change="onSelectRoomForCustom('bottom', $event.target.value)" class="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                    <option value="">-- พิมพ์เองอิสระ --</option>
                    <option v-for="r in rooms" :key="r.id" :value="r.room_number">
                      ห้อง {{ r.room_number }} ({{ r.active_tenant?.name || 'ว่าง' }})
                    </option>
                  </select>
                </div>
                <div>
                  <label class="font-semibold text-slate-600 block mb-1">ประเภทการเช่า:</label>
                  <select v-model="customPair.bottom.invoice_type" @change="onCustomTypeChange('bottom')" class="w-full border border-slate-300 rounded-lg px-2 py-1.5 bg-white">
                    <option value="daily">ลูกค้ารายวัน</option>
                    <option value="monthly">ลูกค้ารายเดือน</option>
                    <option value="custom">กำหนดเอง (หักมัดจำ/ย้ายออก)</option>
                  </select>
                </div>
                <div v-if="customPair.bottom.invoice_type === 'daily'">
                  <label class="font-semibold text-slate-600 block mb-1">จำนวนวัน × เรทรายวัน:</label>
                  <div class="flex items-center gap-1">
                    <input v-model.number="customPair.bottom.days_count" @input="calcDailyCustom('bottom')" type="number" min="1" class="w-14 border border-slate-300 rounded px-1.5 py-1 bg-white text-center" />
                    <span>×</span>
                    <input v-model.number="customPair.bottom.daily_rate" @input="calcDailyCustom('bottom')" type="number" class="w-20 border border-slate-300 rounded px-1.5 py-1 bg-white text-right" />
                  </div>
                </div>
                <div class="col-span-2 sm:col-span-3 flex flex-wrap gap-2 pt-1">
                  <button @click="applyMoveOutTemplate('bottom')" class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-semibold hover:bg-rose-200 cursor-pointer">
                    + กรณีหักค่ามัดจำ 2,500 บาท (ย้ายออก)
                  </button>
                  <button @click="applyDailyTemplate('bottom')" class="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-lg font-semibold hover:bg-sky-200 cursor-pointer">
                    + ตั้งค่าเริ่มต้นลูกค้ารายวัน
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-900">
            <span>💡 <strong>คำแนะนำ:</strong> คลิกแก้ไขข้อความ ตัวเลข ชื่อห้อง รายการค่าห้อง ค่าน้ำ ค่าไฟ หรือค่าอื่นๆ บนกระดาษ A4 ด้านล่างได้ทุกช่อง</span>
            <label class="flex items-center gap-1.5 font-bold cursor-pointer">
              <input type="checkbox" v-model="customEditableMode" />
              <span>เปิดโหมดคลิกแก้ไขทุกบรรทัด</span>
            </label>
          </div>
        </div>

        <!-- Printable Custom / Daily A4 Sheet -->
        <div class="a4-sheet">
          <ReceiptHalfA4
            :doc="customPair.top"
            :settings="settings"
            :editable="customEditableMode && !customPair.top.is_blank"
            @update:doc="(val) => Object.assign(customPair.top, val)"
          />
          <div class="receipt-divider"></div>
          <ReceiptHalfA4
            :doc="customPair.bottom"
            :settings="settings"
            :editable="customEditableMode && !customPair.bottom.is_blank"
            @update:doc="(val) => Object.assign(customPair.bottom, val)"
          />
        </div>
      </section>

      <!-- ===================================================== -->
      <!-- TAB 4: ROOMS & TENANT DATABASE + STAY HISTORY         -->
      <!-- ===================================================== -->
      <section v-if="activeTab === 'rooms'" class="no-print space-y-6">
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900">
              👥 ทะเบียนห้องพัก &amp; ฐานข้อมูลประวัติผู้เช่า (ย้ายห้อง / ประวัติเข้าพัก / เอกสารบัตร ปชช.-ทะเบียนบ้าน)
            </h2>
            <p class="text-sm text-slate-500">
              จัดการห้องพักพร้อมระบบฐานข้อมูลลูกค้า เก็บสำเนาบัตรประชาชน/ทะเบียนบ้าน (ทางเลือก ไม่บังคับ) และดูไทม์ไลน์การย้ายห้องหรือเข้าพักย้อนหลังรายบุคคล
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <div class="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                @click="roomSubTab = 'rooms'"
                class="px-3.5 py-1.5 rounded-lg cursor-pointer"
                :class="roomSubTab === 'rooms' ? 'bg-slate-900 text-white' : 'text-slate-600'"
              >
                🏢 ตารางห้องพัก ({{ rooms.length }} ห้อง)
              </button>
              <button
                @click="roomSubTab = 'tenants'"
                class="px-3.5 py-1.5 rounded-lg cursor-pointer"
                :class="roomSubTab === 'tenants' ? 'bg-indigo-600 text-white' : 'text-slate-600'"
              >
                🪪 ฐานข้อมูลลูกค้า &amp; ประวัติการเข้าพัก/ย้ายห้อง ({{ tenants.length }} ราย)
              </button>
            </div>

            <button
              v-if="roomSubTab === 'rooms'"
              @click="openRoomModal()"
              class="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer"
            >
              + เพิ่มห้องพักใหม่
            </button>
            <button
              v-else
              @click="openTenantProfileModal()"
              class="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer"
            >
              + ลงทะเบียนประวัติลูกค้าใหม่
            </button>
          </div>
        </div>

        <!-- SUB-VIEW A: ROOMS TABLE -->
        <div v-if="roomSubTab === 'rooms'" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left border-collapse">
              <thead>
                <tr class="bg-slate-800 text-white text-xs uppercase">
                  <th class="p-3">หมายเลขห้อง</th>
                  <th class="p-3">โซน</th>
                  <th class="p-3">ผู้เช่าปัจจุบัน</th>
                  <th class="p-3 text-center">เอกสารแนบ</th>
                  <th class="p-3 text-center">จำนวนผู้พัก</th>
                  <th class="p-3 text-right">ค่าเช่ารายเดือน</th>
                  <th class="p-3">การคิดค่าน้ำ</th>
                  <th class="p-3 text-center">เรทค่าไฟ</th>
                  <th class="p-3 text-center">มิเตอร์น้ำล่าสุด</th>
                  <th class="p-3 text-center">มิเตอร์ไฟล่าสุด</th>
                  <th class="p-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr v-for="room in rooms" :key="room.id" class="hover:bg-slate-50">
                  <td class="p-3 font-bold text-slate-900">{{ room.room_number }}</td>
                  <td class="p-3 text-xs text-slate-500">{{ room.zone }}</td>
                  <td class="p-3">
                    <div class="font-bold text-emerald-700">{{ room.active_tenant?.name || 'ว่าง' }}</div>
                    <div v-if="room.active_tenant?.phone" class="text-[11px] text-slate-400">📞 {{ room.active_tenant.phone }}</div>
                  </td>
                  <td class="p-3 text-center">
                    <button
                      v-if="room.active_tenant"
                      @click="openTenantByRoom(room)"
                      class="px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border"
                      :class="(findTenantObj(room.active_tenant.id)?.id_card_image_url || findTenantObj(room.active_tenant.id)?.house_reg_image_url)
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'"
                    >
                      {{ (findTenantObj(room.active_tenant.id)?.id_card_image_url || findTenantObj(room.active_tenant.id)?.house_reg_image_url) ? '🪪 มีสำเนาเอกสาร' : '📁 แฟ้มลูกค้า/ย้ายห้อง' }}
                    </button>
                  </td>
                  <td class="p-3 text-center font-medium">{{ room.active_tenant?.occupant_count || 1 }} คน</td>
                  <td class="p-3 text-right font-bold">฿{{ formatNumber(room.monthly_rate) }}</td>
                  <td class="p-3 text-xs">
                    <span v-if="room.water_calc_type === 'meter'" class="text-sky-700 font-semibold">
                      ตามมิเตอร์ ({{ room.water_rate }} บ./หน่วย)
                    </span>
                    <span v-else-if="room.water_calc_type === 'per_person'" class="text-indigo-700 font-semibold">
                      เหมาตามคน ({{ (room.active_tenant?.occupant_count || 1) * 100 }} บ.)
                    </span>
                    <span v-else class="text-slate-700 font-semibold">เหมาจ่าย {{ room.water_flat_amount }} บ.</span>
                  </td>
                  <td class="p-3 text-center font-semibold text-amber-700">{{ room.electric_rate }} บ.</td>
                  <td class="p-3 text-center font-mono text-xs">{{ room.latest_water_meter || '-' }}</td>
                  <td class="p-3 text-center font-mono text-xs">{{ room.latest_electric_meter || '-' }}</td>
                  <td class="p-3 text-center space-x-2 whitespace-nowrap">
                    <button @click="openRoomModal(room)" class="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">
                      แก้ไขห้อง
                    </button>
                    <button @click="viewRoomHistory(room.room_number)" class="text-xs font-bold text-emerald-600 hover:underline cursor-pointer">
                      ดู Log
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- SUB-VIEW B: TENANT CUSTOMER DATABASE & STAY HISTORY TIMELINE -->
        <div v-else class="space-y-4">
          <!-- Search & Filter Bar -->
          <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-3 flex-1">
              <input
                v-model="tenantSearch"
                placeholder="🔍 ค้นหาชื่อผู้เช่า, หมายเลขห้อง, เบอร์โทร, เลขบัตรประชาชน..."
                class="w-full sm:w-80 border border-slate-300 rounded-xl px-3.5 py-2 text-sm bg-white"
              />
              <select v-model="tenantStatusFilter" class="border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="all">ผู้เช่าทั้งหมด (ทั้งปัจจุบันและย้ายออกแล้ว)</option>
                <option value="active">กำลังเข้าพักอยู่ปัจจุบัน</option>
                <option value="inactive">ย้ายออกแล้ว (อดีตผู้เช่า)</option>
              </select>
            </div>
            <div class="text-xs text-slate-500">
              📌 <strong>หมายเหตุ:</strong> การอัปโหลดรูปสำเนาบัตรประชาชนและทะเบียนบ้านเป็นทางเลือก (Optional) ไม่บังคับกรอก
            </div>
          </div>

          <!-- Tenant Profile Cards with Stay History Timeline -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="t in filteredTenants"
              :key="t.id"
              class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between space-y-4"
            >
              <div>
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-lg">
                      {{ (t.name || '?').slice(0, 2) }}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h3 class="font-extrabold text-slate-900 text-base">{{ t.name }}</h3>
                        <span
                          class="px-2 py-0.5 rounded-full text-[11px] font-bold"
                          :class="t.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'"
                        >
                          {{ t.is_active ? `กำลังพักห้อง ${t.room_number}` : `ย้ายออกแล้ว (ห้องล่าสุด ${t.room_number})` }}
                        </span>
                      </div>
                      <div class="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-3">
                        <span>📞 {{ t.phone || 'ไม่ได้ระบุเบอร์โทร' }}</span>
                        <span>👥 ผู้พัก {{ t.occupant_count || 1 }} คน</span>
                        <span>💰 มัดจำ ฿{{ formatNumber(t.deposit_amount || 2500) }}</span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <button
                      @click="openTenantProfileModal(t)"
                      class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      ✏️ แก้ไข/แนบเอกสาร
                    </button>
                    <button
                      @click="openTransferModal(t)"
                      class="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold cursor-pointer border border-indigo-200"
                    >
                      🔄 ย้ายห้อง/แจ้งย้ายออก
                    </button>
                  </div>
                </div>

                <!-- Optional Document Badges / Thumbnails -->
                <div class="flex flex-wrap items-center gap-2 pt-3">
                  <div
                    class="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
                    :class="t.id_card_image_url ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'"
                  >
                    <span>🪪 สำเนาบัตรประชาชน:</span>
                    <button
                      v-if="t.id_card_image_url"
                      @click="previewDocumentImage(t.id_card_image_url, `สำเนาบัตรประชาชน - ${t.name}`)"
                      class="font-bold underline text-emerald-700 cursor-pointer"
                    >
                      เปิดดูรูปภาพ
                    </button>
                    <span v-else>ไม่ได้แนบ (ไม่บังคับ)</span>
                  </div>

                  <div
                    class="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs"
                    :class="t.house_reg_image_url ? 'bg-sky-50/70 border-sky-200 text-sky-800' : 'bg-slate-50 border-slate-200 text-slate-400'"
                  >
                    <span>🏠 สำเนาทะเบียนบ้าน:</span>
                    <button
                      v-if="t.house_reg_image_url"
                      @click="previewDocumentImage(t.house_reg_image_url, `สำเนาทะเบียนบ้าน - ${t.name}`)"
                      class="font-bold underline text-sky-700 cursor-pointer"
                    >
                      เปิดดูรูปภาพ
                    </button>
                    <span v-else>ไม่ได้แนบ (ไม่บังคับ)</span>
                  </div>
                </div>

                <!-- Stay History & Room Transfer Timeline -->
                <div class="mt-3 pt-3 border-t border-slate-100">
                  <div class="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>🕒 ประวัติการเข้าพักและการเปลี่ยนห้องทั้งหมด ({{ (t.stays || []).length }} รายการ)</span>
                    <span class="text-emerald-700">ชำระสะสมรวม ฿{{ formatNumber(t.total_paid || 0) }} ({{ (t.invoices || []).length }} บิล)</span>
                  </div>
                  <div class="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    <div
                      v-for="st in t.stays"
                      :key="st.id"
                      class="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs flex items-center justify-between"
                    >
                      <div>
                        <div class="font-bold text-slate-800 flex items-center gap-1.5">
                          <span
                            class="px-1.5 py-0.2 rounded text-[10px]"
                            :class="st.event_type === 'room_transfer'
                              ? 'bg-indigo-100 text-indigo-800'
                              : (st.status === 'moved_out' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800')"
                          >
                            {{ st.event_type === 'room_transfer' ? `ย้ายห้อง (${st.previous_room_number} → ${st.room_number})` : (st.status === 'moved_out' ? 'ย้ายออกแล้ว' : 'เข้าพัก') }}
                          </span>
                          <span>ห้อง {{ st.room_number }}</span>
                        </div>
                        <div class="text-[11px] text-slate-500 mt-0.5">{{ st.notes || '-' }}</div>
                      </div>
                      <div class="text-right text-[11px] text-slate-500 shrink-0">
                        <div>เริ่ม: {{ st.start_date }}</div>
                        <div v-if="st.end_date">สิ้นสุด: {{ st.end_date }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal 1: Room Edit/Create -->
        <div
          v-if="roomModal.show"
          class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 class="text-lg font-bold text-slate-900">
              {{ roomModal.form.id ? `แก้ไขข้อมูลห้อง ${roomModal.form.room_number}` : 'เพิ่มห้องพักและผู้เช่าใหม่' }}
            </h3>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">หมายเลขห้อง *</label>
                <input v-model="roomModal.form.room_number" class="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="เช่น 320, 111" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">โซนอาคาร</label>
                <input v-model="roomModal.form.zone" class="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="เช่น โซนบ้านพัก 320, ชั้น 1" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">ชื่อผู้เช่าปัจจุบัน</label>
                <input v-model="roomModal.form.tenant_name" class="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="ชื่อเล่น หรือ ชื่อ-สกุล" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">จำนวนผู้เข้าพัก (คน)</label>
                <input v-model.number="roomModal.form.occupant_count" type="number" min="1" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">ประเภทห้องพัก</label>
                <select v-model="roomModal.form.rental_type" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  <option value="monthly">รายเดือน</option>
                  <option value="daily">รายวัน</option>
                  <option value="both">ทั้งรายเดือนและรายวัน</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">เงินมัดจำ (บาท)</label>
                <input v-model.number="roomModal.form.deposit_amount" type="number" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">อัตราค่าเช่ารายเดือน (บาท)</label>
                <input v-model.number="roomModal.form.monthly_rate" type="number" class="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">อัตราค่าเช่ารายวัน (บาท/วัน)</label>
                <input v-model.number="roomModal.form.daily_rate" type="number" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">รูปแบบการคิดค่าน้ำ</label>
                <select v-model="roomModal.form.water_calc_type" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  <option value="meter">คิดตามมิเตอร์ (บาท/หน่วย)</option>
                  <option value="per_person">เหมาจ่ายตามจำนวนคน (คนละ 100 บ.)</option>
                  <option value="flat">เหมาจ่ายคงที่ต่อเดือน</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">เรทค่าน้ำ (บาท/หน่วย หรือ บาท/เดือน)</label>
                <input
                  v-if="roomModal.form.water_calc_type === 'meter'"
                  v-model.number="roomModal.form.water_rate"
                  type="number"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
                <input
                  v-else
                  v-model.number="roomModal.form.water_flat_amount"
                  type="number"
                  class="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">เรทค่าไฟ (บาท/หน่วย)</label>
                <input v-model.number="roomModal.form.electric_rate" type="number" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">เลขมิเตอร์น้ำ / ไฟ ล่าสุด</label>
                <div class="flex gap-1.5">
                  <input v-model="roomModal.form.latest_water_meter" placeholder="น้ำ" class="w-1/2 border border-slate-300 rounded-lg px-2 py-2 text-center" />
                  <input v-model="roomModal.form.latest_electric_meter" placeholder="ไฟ" class="w-1/2 border border-slate-300 rounded-lg px-2 py-2 text-center" />
                </div>
              </div>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button @click="roomModal.show = false" class="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold cursor-pointer">
                ยกเลิก
              </button>
              <button @click="saveRoomModal" class="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer">
                บันทึกข้อมูล
              </button>
            </div>
          </div>
        </div>

        <!-- Modal 2: Tenant Profile + Optional ID Card / House Registration Upload -->
        <div
          v-if="tenantModal.show"
          class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div class="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div class="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 class="text-lg font-bold text-slate-900">
                  🪪 {{ tenantModal.form.id ? `แฟ้มประวัติลูกค้า: ${tenantModal.form.name}` : 'ลงทะเบียนประวัติลูกค้าใหม่' }}
                </h3>
                <p class="text-xs text-slate-500">
                  สามารถแนบรูปสำเนาบัตรประชาชนและสำเนาทะเบียนบ้านเก็บไว้ในฐานข้อมูลได้ (ทางเลือก ไม่บังคับ)
                </p>
              </div>
              <button @click="tenantModal.show = false" class="text-slate-400 hover:text-slate-600 text-xl cursor-pointer">✕</button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">ชื่อ-นามสกุล / ชื่อเล่นผู้เช่า *</label>
                <input v-model="tenantModal.form.name" class="w-full border border-slate-300 rounded-lg px-3 py-2 font-bold" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">ห้องพักปัจจุบัน</label>
                <select v-model="tenantModal.form.room_number" @change="onTenantModalRoomSelect" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  <option v-for="r in rooms" :key="r.id" :value="r.room_number">ห้อง {{ r.room_number }} ({{ r.zone }})</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">เบอร์โทรศัพท์</label>
                <input v-model="tenantModal.form.phone" placeholder="08x-xxx-xxxx (ไม่บังคับ)" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">เลขบัตรประจำตัวประชาชน (ไม่บังคับ)</label>
                <input v-model="tenantModal.form.id_card" placeholder="x-xxxx-xxxxx-xx-x" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">วันที่เข้าพัก</label>
                <input v-model="tenantModal.form.check_in_date" type="date" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs font-bold text-slate-600 mb-1">จำนวนผู้พัก (คน)</label>
                  <input v-model.number="tenantModal.form.occupant_count" type="number" min="1" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-600 mb-1">เงินมัดจำ (บาท)</label>
                  <input v-model.number="tenantModal.form.deposit_amount" type="number" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
                </div>
              </div>
              <div class="sm:col-span-2">
                <label class="block text-xs font-bold text-slate-600 mb-1">ที่อยู่ตามทะเบียนบ้าน / ผู้ติดต่อฉุกเฉิน (ไม่บังคับ)</label>
                <input v-model="tenantModal.form.home_address" placeholder="ระบุที่อยู่หรือเบอร์ติดต่อฉุกเฉิน..." class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
            </div>

            <!-- Optional Document Image Uploads -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <!-- ID Card Copy -->
              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <div class="text-xs font-bold text-slate-700">🪪 รูปสำเนาบัตรประชาชน (ไม่บังคับ)</div>
                <div class="h-32 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden p-1">
                  <img v-if="tenantModal.form.id_card_image_url" :src="tenantModal.form.id_card_image_url" class="max-h-full object-contain" />
                  <span v-else class="text-xs text-slate-400">ยังไม่ได้แนบรูปสำเนาบัตรประชาชน</span>
                </div>
                <div class="flex justify-center gap-2">
                  <label class="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer">
                    <span>อัปโหลดรูปบัตร ปชช.</span>
                    <input type="file" accept="image/*" @change="(e) => onUploadTenantDoc(e, 'id_card_image_url')" class="hidden" />
                  </label>
                  <button
                    v-if="tenantModal.form.id_card_image_url"
                    @click="tenantModal.form.id_card_image_url = null"
                    class="text-xs text-rose-600 font-semibold hover:underline cursor-pointer"
                  >
                    ลบรูป
                  </button>
                </div>
              </div>

              <!-- House Registration Copy -->
              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <div class="text-xs font-bold text-slate-700">🏠 รูปสำเนาทะเบียนบ้าน (ไม่บังคับ)</div>
                <div class="h-32 bg-white border border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden p-1">
                  <img v-if="tenantModal.form.house_reg_image_url" :src="tenantModal.form.house_reg_image_url" class="max-h-full object-contain" />
                  <span v-else class="text-xs text-slate-400">ยังไม่ได้แนบรูปสำเนาทะเบียนบ้าน</span>
                </div>
                <div class="flex justify-center gap-2">
                  <label class="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer">
                    <span>อัปโหลดรูปทะเบียนบ้าน</span>
                    <input type="file" accept="image/*" @change="(e) => onUploadTenantDoc(e, 'house_reg_image_url')" class="hidden" />
                  </label>
                  <button
                    v-if="tenantModal.form.house_reg_image_url"
                    @click="tenantModal.form.house_reg_image_url = null"
                    class="text-xs text-rose-600 font-semibold hover:underline cursor-pointer"
                  >
                    ลบรูป
                  </button>
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button @click="tenantModal.show = false" class="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold cursor-pointer">
                ยกเลิก
              </button>
              <button @click="saveTenantProfileModal" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer">
                💾 บันทึกแฟ้มประวัติลูกค้า
              </button>
            </div>
          </div>
        </div>

        <!-- Modal 3: Room Transfer / Move-out History Recorder -->
        <div
          v-if="transferModal.show"
          class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 class="text-lg font-bold text-slate-900">
              🔄 บันทึกการย้ายห้อง / การเข้าพัก / แจ้งย้ายออก
            </h3>
            <p class="text-xs text-slate-500">
              ผู้เช่า: <strong>{{ transferModal.tenant?.name }}</strong> (ห้องปัจจุบัน: <strong>{{ transferModal.tenant?.room_number }}</strong>)
            </p>

            <div class="space-y-3 text-sm">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">ประเภทรายการ</label>
                <select v-model="transferModal.form.event_type" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-semibold">
                  <option value="room_transfer">🔄 ย้ายห้องพัก (เก็บประวัติห้องเดิมและเริ่มห้องใหม่)</option>
                  <option value="move_out">🚪 แจ้งย้ายออก (สิ้นสุดสัญญาปัจจุบัน)</option>
                  <option value="check_in">🔑 กลับมาเข้าพักใหม่ (Re-Check-in)</option>
                </select>
              </div>

              <div v-if="transferModal.form.event_type !== 'move_out'">
                <label class="block text-xs font-bold text-slate-600 mb-1">เลือกหมายเลขห้องใหม่ที่ย้ายเข้า</label>
                <select v-model="transferModal.form.new_room_number" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-bold">
                  <option v-for="r in rooms" :key="r.id" :value="r.room_number">
                    ห้อง {{ r.room_number }} ({{ r.zone }} - ฿{{ formatNumber(r.monthly_rate) }})
                  </option>
                </select>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="block text-xs font-bold text-slate-600 mb-1">วันที่ทำรายการ</label>
                  <input v-model="transferModal.form.event_date" type="date" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-600 mb-1">อัตราค่าเช่า (บาท)</label>
                  <input v-model.number="transferModal.form.rate_amount" type="number" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">หมายเหตุ / เหตุผลการย้ายห้อง</label>
                <input
                  v-model="transferModal.form.notes"
                  placeholder="เช่น ขอย้ายไปห้องชั้นล่าง / ย้ายโซน..."
                  class="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button @click="transferModal.show = false" class="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold cursor-pointer">
                ยกเลิก
              </button>
              <button @click="submitRoomTransfer" class="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold cursor-pointer">
                ยืนยันบันทึกประวัติ
              </button>
            </div>
          </div>
        </div>

        <!-- Modal 4: Document Image Lightbox Preview -->
        <div
          v-if="docPreview.show"
          @click="docPreview.show = false"
          class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-6"
        >
          <div @click.stop class="bg-white rounded-2xl max-w-xl w-full p-4 shadow-2xl space-y-3">
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 class="font-bold text-slate-900 text-sm">{{ docPreview.title }}</h4>
              <button @click="docPreview.show = false" class="text-slate-500 hover:text-slate-900 font-bold cursor-pointer">✕ ปิด</button>
            </div>
            <div class="max-h-[70vh] overflow-auto flex justify-center bg-slate-100 rounded-xl p-2">
              <img :src="docPreview.url" class="max-w-full object-contain" />
            </div>
          </div>
        </div>
      </section>

      <!-- ===================================================== -->
      <!-- TAB 5: ACCOUNTING (บัญชีรายรับ-รายจ่าย ซ่อมบำรุง & ต้นทุนแฝง) -->
      <!-- ===================================================== -->
      <section v-if="activeTab === 'accounting'" class="space-y-6">
        <!-- Top Control Bar (Hidden when printing) -->
        <div class="no-print bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  Income &amp; Expense Accounting
                </span>
              </div>
              <h2 class="text-xl font-bold text-slate-900 mt-1">
                💼 ระบบบัญชีรายรับ-รายจ่ายภาพรวม ค่าซ่อมบำรุง และค่าใช้จ่ายแฝง (พร้อมรายงานมืออาชีพ A4)
              </h2>
              <p class="text-sm text-slate-500">
                นำยอดค่าเช่าของแต่ละเดือนมาเป็นรายรับอัตโนมัติ หักลบด้วยรายการซ่อมบำรุง ต้นทุนน้ำ-ไฟส่วนกลาง และค่าใช้จ่ายแฝงต่างๆ
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <select
                v-model="dashFilter.month"
                @change="onDashPeriodChange"
                class="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold bg-white"
              >
                <option v-for="m in thaiMonths" :key="m" :value="m">{{ m }}</option>
              </select>
              <select
                v-model.number="dashFilter.year_be"
                @change="onDashPeriodChange"
                class="border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold bg-white"
              >
                <option v-for="y in [2568, 2569, 2570]" :key="y" :value="y">{{ y }}</option>
              </select>

              <button
                @click="openAccountingModal()"
                class="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer"
              >
                + บันทึกรายการซ่อมบำรุง / ค่าใช้จ่ายแฝง / รายรับเสริม
              </button>

              <button
                @click="triggerPrint"
                class="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow cursor-pointer flex items-center gap-1.5"
              >
                <span>🖨️</span>
                <span>พิมพ์งบกำไรขาดทุนระดับมืออาชีพ (A4)</span>
              </button>
            </div>
          </div>

          <!-- View Switcher & Quick Summary -->
          <div class="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <div class="flex items-center gap-2">
              <button
                @click="accountingViewMode = 'split'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                :class="accountingViewMode === 'split' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'"
              >
                ตารางจัดการบัญชี + รายงานทางการเงิน A4
              </button>
              <button
                @click="accountingViewMode = 'report'"
                class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                :class="accountingViewMode === 'report' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'"
              >
                📄 เฉพาะรายงานงบกำไรขาดทุนมาตรฐาน A4
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-4 text-xs">
              <span class="font-semibold text-slate-600">
                รายรับค่าเช่ารวม: <strong class="text-emerald-600 text-sm">฿{{ formatNumber(dashboard.monthly_summary?.total_income || 0) }}</strong>
              </span>
              <span class="font-semibold text-slate-600">
                ต้นทุนทางตรง/ซ่อมบำรุง: <strong class="text-rose-600 text-sm">-฿{{ formatNumber(dashboard.monthly_summary?.direct_expenses || 0) }}</strong>
              </span>
              <span class="font-semibold text-slate-600">
                ค่าใช้จ่ายแฝง: <strong class="text-purple-600 text-sm">-฿{{ formatNumber(dashboard.monthly_summary?.hidden_expenses || 0) }}</strong>
              </span>
              <span class="font-extrabold text-slate-900 bg-emerald-100 px-3 py-1 rounded-lg">
                กำไรสุทธิ: ฿{{ formatNumber(dashboard.monthly_summary?.net_profit || 0) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Interactive Ledger Table (Hidden when printing) -->
        <div v-if="accountingViewMode === 'split'" class="no-print bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 class="font-bold text-slate-900 text-sm">
              📋 รายการบันทึกค่าซ่อมบำรุง ต้นทุนสาธารณูปโภค และค่าใช้จ่ายแฝง ประจำเดือน {{ dashFilter.month }} {{ dashFilter.year_be }}
            </h3>
            <span class="text-xs text-slate-500">ทั้งหมด {{ accountingList.length }} รายการ</span>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left border-collapse">
              <thead>
                <tr class="bg-slate-800 text-white text-xs uppercase">
                  <th class="p-3">วันที่</th>
                  <th class="p-3">เลขที่อ้างอิง</th>
                  <th class="p-3">ประเภทต้นทุน</th>
                  <th class="p-3">หมวดหมู่</th>
                  <th class="p-3">รายการ / รายละเอียดการซ่อมบำรุง</th>
                  <th class="p-3 text-center">ห้อง/โซน</th>
                  <th class="p-3">ผู้รับเงิน/ร้านค้า</th>
                  <th class="p-3 text-right">จำนวนเงิน</th>
                  <th class="p-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                <tr v-for="tx in accountingList" :key="tx.id" class="hover:bg-slate-50">
                  <td class="p-3 text-xs text-slate-500 whitespace-nowrap">{{ tx.tx_date }}</td>
                  <td class="p-3 font-mono text-xs">{{ tx.reference_doc || tx.tx_code }}</td>
                  <td class="p-3">
                    <span
                      class="px-2 py-0.5 rounded-full text-xs font-bold"
                      :class="tx.tx_type === 'income'
                        ? 'bg-emerald-100 text-emerald-800'
                        : (tx.cost_nature === 'hidden' ? 'bg-purple-100 text-purple-800' : 'bg-rose-100 text-rose-800')"
                    >
                      {{ tx.tx_type === 'income' ? 'รายรับเสริม' : (tx.cost_nature === 'hidden' ? 'ค่าใช้จ่ายแฝง (Hidden)' : 'ต้นทุนทางตรง/ซ่อมบำรุง') }}
                    </span>
                  </td>
                  <td class="p-3 text-xs font-semibold text-slate-700">{{ tx.category }}</td>
                  <td class="p-3">
                    <div class="font-bold text-slate-900 text-xs sm:text-sm">{{ tx.title }}</div>
                    <div v-if="tx.description" class="text-xs text-slate-500">{{ tx.description }}</div>
                  </td>
                  <td class="p-3 text-center font-bold text-slate-700">{{ tx.room_number || 'ส่วนกลาง' }}</td>
                  <td class="p-3 text-xs text-slate-600">{{ tx.vendor_or_payee || '-' }}</td>
                  <td class="p-3 text-right font-extrabold" :class="tx.tx_type === 'income' ? 'text-emerald-600' : 'text-rose-600'">
                    {{ tx.tx_type === 'income' ? '+' : '-' }}฿{{ formatNumber(tx.amount) }}
                  </td>
                  <td class="p-3 text-center space-x-2 whitespace-nowrap">
                    <button @click="openAccountingModal(tx)" class="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">
                      แก้ไข
                    </button>
                    <button @click="deleteAccountingTx(tx.id)" class="text-xs font-bold text-rose-600 hover:underline cursor-pointer">
                      ลบ
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- PRINTABLE PROFESSIONAL A4 ACCOUNTING & P&L REPORT -->
        <div class="print-area">
          <div class="no-print text-center mb-3">
            <span class="inline-block bg-slate-900 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow">
              📄 รายงานงบกำไรขาดทุนและทะเบียนค่าใช้จ่ายระดับมืออาชีพ ขนาด A4 (พร้อมช่องลงนามผู้บริหาร)
            </span>
          </div>
          <ProfessionalAccountingReportA4
            :dashboard="dashboard"
            :transactions="accountingList"
            :settings="settings"
          />
        </div>

        <!-- Accounting Create/Edit Modal -->
        <div
          v-if="accModal.show"
          class="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 class="text-lg font-bold text-slate-900">
              {{ accModal.form.id ? 'แก้ไขรายการทางบัญชี' : 'บันทึกรายการซ่อมบำรุง / ค่าใช้จ่ายแฝง / รายรับเสริม' }}
            </h3>

            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">ประเภทรายการ</label>
                <select v-model="accModal.form.tx_type" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-bold">
                  <option value="expense">🔻 รายจ่าย (Expense)</option>
                  <option value="income">🔺 รายรับเสริม (Extra Income)</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">ลักษณะต้นทุน</label>
                <select v-model="accModal.form.cost_nature" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white font-bold">
                  <option value="direct">ต้นทุนทางตรง / ซ่อมบำรุง</option>
                  <option value="hidden">ค่าใช้จ่ายแฝง (Hidden Cost)</option>
                  <option value="fixed">ค่าใช้จ่ายคงที่รายเดือน</option>
                </select>
              </div>

              <div class="col-span-2">
                <label class="block text-xs font-bold text-slate-600 mb-1">หมวดหมู่รายการ</label>
                <select v-model="accModal.form.category" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  <option value="ค่าซ่อมบำรุงห้องพัก">🔧 ค่าซ่อมบำรุงห้องพัก (ประปา/ไฟฟ้า/ทาสี/รีโนเวท)</option>
                  <option value="ค่าซ่อมบำรุงอุปกรณ์/แอร์">❄️ ค่าซ่อมบำรุงอุปกรณ์ / ล้างแอร์ / เครื่องทำน้ำอุ่น</option>
                  <option value="ค่าสาธารณูปโภคต้นทุน (การไฟฟ้า/ประปา)">⚡💧 ค่าสาธารณูปโภคต้นทุน (บิลการไฟฟ้า/การประปาหลัก)</option>
                  <option value="ค่าใช้จ่ายแฝง / ค่าเสื่อมและวัสดุสิ้นเปลือง">🧹 ค่าใช้จ่ายแฝง / วัสดุทำความสะอาด / หลอดไฟสำรอง</option>
                  <option value="ค่าใช้จ่ายแฝง / อินเทอร์เน็ตและระบบรักษาความปลอดภัย">🌐 ค่าใช้จ่ายแฝง / อินเทอร์เน็ต Wi-Fi / กล้อง CCTV</option>
                  <option value="ค่าใช้จ่ายแฝง / ค่าจัดเก็บขยะและดูแลสวน">🌿 ค่าใช้จ่ายแฝง / ค่าขยะเทศบาล / ตัดหญ้าดูแลสวน</option>
                  <option value="รายรับเสริมอื่นๆ">💰 รายรับเสริมอื่นๆ (เช่น ค่าปรับ, ค่าคีย์การ์ด, เครื่องซักผ้าหยอดเหรียญ)</option>
                </select>
              </div>

              <div class="col-span-2">
                <label class="block text-xs font-bold text-slate-600 mb-1">หัวข้อรายการ *</label>
                <input v-model="accModal.form.title" placeholder="เช่น เปลี่ยนก๊อกน้ำห้อง 219 / ค่าเน็ตส่วนกลาง..." class="w-full border border-slate-300 rounded-lg px-3 py-2 font-semibold" />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">จำนวนเงิน (บาท) *</label>
                <input v-model.number="accModal.form.amount" type="number" class="w-full border border-slate-300 rounded-lg px-3 py-2 font-extrabold text-rose-600" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">ห้องพักที่เกี่ยวข้อง / ส่วนกลาง</label>
                <select v-model="accModal.form.room_number" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">
                  <option value="ส่วนกลาง">🏢 ส่วนกลาง (ทั้งหอพัก)</option>
                  <option value="โซน 320">🏡 โซนบ้านพัก 320</option>
                  <option v-for="r in rooms" :key="r.id" :value="r.room_number">ห้อง {{ r.room_number }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">วันที่เกิดรายการ</label>
                <input v-model="accModal.form.tx_date" type="date" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">เลขที่ใบเสร็จอ้างอิง</label>
                <input v-model="accModal.form.reference_doc" placeholder="เช่น REP-6911-05" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>

              <div class="col-span-2">
                <label class="block text-xs font-bold text-slate-600 mb-1">ชื่อช่าง / ร้านค้า / ผู้รับเงิน</label>
                <input v-model="accModal.form.vendor_or_payee" placeholder="เช่น ช่างสมศักดิ์ / การไฟฟ้าส่วนภูมิภาค" class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>

              <div class="col-span-2">
                <label class="block text-xs font-bold text-slate-600 mb-1">รายละเอียดเพิ่มเติม</label>
                <input v-model="accModal.form.description" placeholder="หมายเหตุเพิ่มเติม..." class="w-full border border-slate-300 rounded-lg px-3 py-2" />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button @click="accModal.show = false" class="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold cursor-pointer">
                ยกเลิก
              </button>
              <button @click="saveAccountingModal" class="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer">
                💾 บันทึกรายการบัญชี
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================================================== -->
      <!-- TAB 6: HISTORY LOGS (แยกตามรายชื่อผู้เช่า / หมายเลขห้อง) -->
      <!-- ===================================================== -->
      <section v-if="activeTab === 'logs'" class="no-print space-y-6">
        <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-bold text-slate-900">📜 ประวัติและล็อกไฟล์ (แยกตามรายชื่อผู้เช่า &amp; ตามหมายเลขห้อง)</h2>
              <p class="text-sm text-slate-500">
                บันทึกทุกกิจกรรมการออกบิล เลขมิเตอร์น้ำ-ไฟ การย้ายห้อง การหักค่ามัดจำ และรายการทางบัญชี
              </p>
            </div>

            <div class="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
              <button
                @click="logGroupMode = 'room'"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                :class="logGroupMode === 'room' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'"
              >
                🚪 แยกตามหมายเลขห้อง
              </button>
              <button
                @click="logGroupMode = 'tenant'"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                :class="logGroupMode === 'tenant' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'"
              >
                👤 แยกตามรายชื่อผู้เช่า
              </button>
              <button
                @click="logGroupMode = 'timeline'"
                class="px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                :class="logGroupMode === 'timeline' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'"
              >
                🕒 เรียงตามเวลาล่าสุด
              </button>
            </div>
          </div>

          <!-- Filter Inputs -->
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label class="text-xs font-semibold text-slate-500 block mb-1">กรองตามหมายเลขห้อง:</label>
              <select v-model="logFilter.room_number" @change="loadLogs" class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="">-- ทุกหมายเลขห้อง --</option>
                <option v-for="r in rooms" :key="r.id" :value="r.room_number">ห้อง {{ r.room_number }} ({{ r.active_tenant?.name || '-' }})</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-500 block mb-1">ค้นหาตามชื่อผู้เช่า:</label>
              <input
                v-model="logFilter.tenant_name"
                @input="loadLogs"
                placeholder="พิมพ์ชื่อผู้เช่า เช่น โปเต้, โดนัท..."
                class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-500 block mb-1">ประเภทกิจกรรม:</label>
              <select v-model="logFilter.action_type" @change="loadLogs" class="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="">-- ทุกประเภท --</option>
                <option value="INVOICE_CREATED">ออกใบเสร็จรับเงิน</option>
                <option value="MOVE_OUT_DEDUCTION">หักค่ามัดจำ / ย้ายออก</option>
                <option value="ROOM_TRANSFER">ย้ายห้องพัก</option>
                <option value="ACCOUNTING_EXPENSE">บันทึกค่าซ่อมบำรุง/รายจ่าย</option>
              </select>
            </div>
            <div class="flex items-end">
              <button
                @click="resetLogFilter"
                class="w-full border border-slate-300 hover:bg-slate-50 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 cursor-pointer"
              >
                ล้างตัวกรอง ({{ logs.length }} รายการ)
              </button>
            </div>
          </div>
        </div>

        <!-- Grouped by Room or Tenant Cards -->
        <div v-if="logGroupMode === 'room' || logGroupMode === 'tenant'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="group in groupedLogs"
            :key="group.key"
            class="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-3"
          >
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 class="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span>{{ logGroupMode === 'room' ? `🚪 ห้อง ${group.key}` : `👤 ผู้เช่า: ${group.key}` }}</span>
                  <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {{ group.items.length }} รายการ
                  </span>
                </h3>
                <p class="text-xs text-slate-500 mt-0.5">{{ group.subtitle }}</p>
              </div>
              <div class="text-right">
                <div class="text-xs text-slate-400">ยอดเงินสะสม</div>
                <div class="font-extrabold text-emerald-600 text-base">฿{{ formatNumber(group.totalAmount) }}</div>
              </div>
            </div>

            <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
              <div
                v-for="log in group.items"
                :key="log.id"
                class="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs space-y-1"
              >
                <div class="flex items-center justify-between">
                  <span
                    class="font-bold px-2 py-0.5 rounded text-[11px]"
                    :class="log.action_type === 'MOVE_OUT_DEDUCTION'
                      ? 'bg-rose-100 text-rose-800'
                      : (log.action_type === 'ROOM_TRANSFER' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800')"
                  >
                    {{ log.action_type }}
                  </span>
                  <span class="text-slate-400">{{ formatDateTime(log.created_at) }}</span>
                </div>
                <div class="text-slate-800 font-medium">{{ log.description }}</div>
                <div v-if="log.metadata?.electric_curr || log.metadata?.water_curr" class="text-[11px] text-slate-500 flex flex-wrap gap-3 pt-1">
                  <span v-if="log.metadata.water_curr">💧 มิเตอร์น้ำ: {{ log.metadata.water_prev }} → {{ log.metadata.water_curr }} ({{ log.metadata.water_total }} บ.)</span>
                  <span v-if="log.metadata.electric_curr">⚡ มิเตอร์ไฟ: {{ log.metadata.electric_prev }} → {{ log.metadata.electric_curr }} ({{ log.metadata.electric_total }} บ.)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Timeline View -->
        <div v-else class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table class="w-full text-sm text-left border-collapse">
            <thead>
              <tr class="bg-slate-800 text-white text-xs uppercase">
                <th class="p-3">วัน-เวลา</th>
                <th class="p-3">ประเภท</th>
                <th class="p-3">ห้อง</th>
                <th class="p-3">ชื่อผู้เช่า</th>
                <th class="p-3">รายละเอียด</th>
                <th class="p-3 text-right">จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              <tr v-for="log in logs" :key="log.id" class="hover:bg-slate-50">
                <td class="p-3 text-xs text-slate-500 whitespace-nowrap">{{ formatDateTime(log.created_at) }}</td>
                <td class="p-3 text-xs font-bold">{{ log.action_type }}</td>
                <td class="p-3 font-bold">{{ log.room_number || '-' }}</td>
                <td class="p-3 font-medium text-emerald-700">{{ log.tenant_name || '-' }}</td>
                <td class="p-3 text-xs">{{ log.description }}</td>
                <td class="p-3 text-right font-bold">
                  {{ log.amount !== null && log.amount !== undefined ? `฿${formatNumber(log.amount)}` : '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ===================================================== -->
      <!-- TAB: REACT PAGINATED MONTHLY METER NOTEBOOK & HUMAN ERROR FIX -->
      <!-- ===================================================== -->
      <section v-if="activeTab === 'notebook'" class="no-print">
        <ReactMeterNotebookHost @synced="onReactNotebookSynced" />
      </section>

      <!-- ===================================================== -->
      <!-- TAB 7: PAYMENT & QR CODE SETTINGS                     -->
      <!-- ===================================================== -->
      <section v-if="activeTab === 'settings'" class="no-print max-w-4xl mx-auto space-y-6">
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
          <div>
            <h2 class="text-xl font-bold text-slate-900">💳 ตั้งค่ารายละเอียดการโอนเงิน &amp; คิวอาร์โค้ด (QR Code)</h2>
            <p class="text-sm text-slate-500">
              ข้อมูลในหน้านี้จะไปแสดงผลที่ด้านล่างของใบเสร็จรับเงินและรายงานผู้บริหารทุกใบโดยอัตโนมัติ
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ชื่อหอพัก (แสดงบนระบบและรายงาน)</label>
                <input v-model="settings.dorm_name" class="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">หัวข้อใบเสร็จรับเงิน</label>
                <input v-model="settings.receipt_title" class="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ชื่อธนาคาร (เช่น ธ.ก.ส., กสิกรไทย, ไทยพาณิชย์)</label>
                <input v-model="settings.bank_name" class="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">เลขที่บัญชีธนาคาร</label>
                <input v-model="settings.account_number" class="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ชื่อบัญชีรับโอน / เจ้าของหอพัก</label>
                <input v-model="settings.account_holder" class="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">ข้อความในกรอบใต้รูป QR Code</label>
                <input v-model="settings.qr_caption" class="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm" />
              </div>

              <div class="grid grid-cols-3 gap-2 pt-2">
                <div>
                  <label class="block text-[11px] font-bold text-slate-600 mb-1">เรทน้ำมิเตอร์ (บ./หน่วย)</label>
                  <input v-model.number="settings.default_water_rate" type="number" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-600 mb-1">น้ำเหมา (บ./คน)</label>
                  <input v-model.number="settings.default_water_per_person" type="number" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
                <div>
                  <label class="block text-[11px] font-bold text-slate-600 mb-1">เรทไฟเริ่มต้น (บ./หน่วย)</label>
                  <input v-model.number="settings.default_electric_rate" type="number" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm" />
                </div>
              </div>
            </div>

            <!-- QR Code Upload & Live Footer Preview -->
            <div class="space-y-4">
              <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center">
                <span class="text-xs font-bold text-slate-600 mb-3">รูปภาพ QR Code รับโอนเงิน</span>
                <div class="w-40 h-40 bg-white border border-slate-300 rounded-xl p-2 flex items-center justify-center shadow-xs mb-3">
                  <img v-if="settings.qr_code_url" :src="settings.qr_code_url" class="w-full h-full object-contain" />
                  <span v-else class="text-xs text-slate-400">ยังไม่มีรูป QR Code</span>
                </div>
                <label class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition">
                  <span>📷 อัปโหลดรูป QR Code ใหม่</span>
                  <input type="file" accept="image/*" @change="onUploadQrCode" class="hidden" />
                </label>
                <p class="text-[11px] text-slate-400 mt-2">รองรับไฟล์ PNG, JPG (บันทึกเก็บในฐานข้อมูล Supabase ทันที)</p>
              </div>

              <!-- Preview of Receipt Footer -->
              <div class="p-4 rounded-xl border border-slate-300 bg-white">
                <div class="text-[11px] text-slate-400 font-semibold mb-2">ตัวอย่างส่วนท้ายใบเสร็จรับเงิน:</div>
                <div class="flex justify-between items-start text-sm font-bold text-black">
                  <div>
                    <div>โอนเลขบัญชี : &nbsp;&nbsp;{{ settings.bank_name }} &nbsp;{{ settings.account_number }}</div>
                    <div class="pl-20 mt-1">{{ settings.account_holder }}</div>
                  </div>
                  <div class="flex flex-col items-center">
                    <img v-if="settings.qr_code_url" :src="settings.qr_code_url" class="w-16 h-16 object-contain" />
                    <div class="border border-black px-2 py-0.5 text-[11px] mt-1">
                      {{ settings.qr_caption || settings.account_holder }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end pt-4 border-t border-slate-200">
            <button
              @click="savePaymentSettings"
              class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow cursor-pointer"
            >
              💾 บันทึกการตั้งค่าการโอนเงินและ QR Code
            </button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import ReceiptHalfA4 from './components/ReceiptHalfA4.vue';
import ExecutiveInfographicA4 from './components/ExecutiveInfographicA4.vue';
import ProfessionalAccountingReportA4 from './components/ProfessionalAccountingReportA4.vue';
import ReactMeterNotebookHost from './components/ReactMeterNotebookHost.vue';
import { toThaiBahtText, formatNumber } from './utils/bahtText.js';

const activeTab = ref('notebook');
const tabs = [
  { id: 'dashboard', label: 'แดชบอร์ด & อินโฟกราฟิก A4', icon: '📊' },
  { id: 'notebook', label: 'สมุดจดมิเตอร์รายเดือน (React)', icon: '📓' },
  { id: 'monthly', label: 'บิลรายเดือน (ชุดเดียว)', icon: '🧾' },
  { id: 'daily', label: 'บิลรายวัน / ฟอร์มเปล่า', icon: '📝' },
  { id: 'rooms', label: 'ห้องพัก & ประวัติผู้เช่า', icon: '👥' },
  { id: 'accounting', label: 'บัญชีรายรับ-รายจ่าย & ซ่อมบำรุง', icon: '💼' },
  { id: 'logs', label: 'ล็อกประวัติ', icon: '📜' },
  { id: 'settings', label: 'ตั้งค่า QR Code', icon: '💳' }
];

const printButtonLabel = computed(() => {
  if (activeTab.value === 'dashboard') return 'พิมพ์อินโฟกราฟิก A4';
  if (activeTab.value === 'accounting') return 'พิมพ์งบกำไรขาดทุน A4';
  return 'พิมพ์ใบเสร็จ A4 (ครึ่งแผ่น)';
});

const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const toast = reactive({ show: false, message: '', type: 'success' });
function showToast(message, type = 'success') {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  setTimeout(() => { toast.show = false; }, 3500);
}

// Settings State
const settings = reactive({
  dorm_name: 'หอพักเอมอร',
  receipt_title: 'ใบเสร็จรับเงินค่าเช่าห้อง',
  bank_name: 'ธ.ก.ส.',
  account_number: '017562024411',
  account_holder: 'นาง เอมอร ไทยนอ',
  qr_code_url: '',
  qr_caption: 'นาง เอมอร ไทยนอ',
  default_water_rate: 10,
  default_water_per_person: 100,
  default_electric_rate: 8
});

// Rooms, Tenants & Invoices State
const rooms = ref([]);
const tenants = ref([]);
const roomSubTab = ref('tenants');
const tenantSearch = ref('');
const tenantStatusFilter = ref('all');

const monthlyDrafts = ref([]);
const monthlyViewMode = ref('split');
const directEditOnReceipt = ref(false);
const savingBatch = ref(false);

const batchPeriod = reactive({
  doc_day: '1',
  billing_month: 'พฤศจิกายน',
  billing_year_be: 2569
});

// Dashboard & Accounting State
const dashViewMode = ref('both');
const accountingViewMode = ref('split');
const dashFilter = reactive({
  month: 'พฤศจิกายน',
  year_be: 2569
});
const dashboard = ref({});
const accountingList = ref([]);

// Modals for Tenant Profile, Room Transfer, Document Preview, and Accounting
const tenantModal = reactive({
  show: false,
  form: {}
});

const transferModal = reactive({
  show: false,
  tenant: null,
  form: {
    event_type: 'room_transfer',
    new_room_number: '',
    event_date: new Date().toISOString().slice(0, 10),
    rate_amount: 2500,
    deposit_amount: 2500,
    notes: ''
  }
});

const docPreview = reactive({
  show: false,
  url: '',
  title: ''
});

const accModal = reactive({
  show: false,
  form: {}
});

// Daily / Custom Receipt Pair (Top & Bottom Half-A4)
const customEditableMode = ref(true);
const customPair = reactive({
  top: createDefaultDoc('daily'),
  bottom: createBlankDoc()
});

function createDefaultDoc(type = 'daily') {
  return {
    receipt_title: 'ใบเสร็จรับเงินค่าเช่าห้อง',
    invoice_type: type,
    doc_day: '1',
    billing_month: 'พฤศจิกายน',
    billing_year_be: 2569,
    tenant_name: 'โปเต้',
    room_number: '320',
    room_rate: 2200,
    daily_rate: 350,
    days_count: 1,
    water_calc_type: 'meter',
    water_prev: '1871',
    water_curr: '1876',
    water_units: 5,
    water_unit_price: 10,
    occupant_count: 1,
    water_total: 50,
    electric_prev: '5094',
    electric_curr: '5169',
    electric_units: 75,
    electric_unit_price: 8,
    electric_total: 600,
    other_description: '',
    other_amount: 0,
    deposit_deduction: 0,
    is_move_out: false,
    total_amount: 2850,
    is_blank: false
  };
}

function createBlankDoc() {
  return {
    receipt_title: 'ใบเสร็จรับเงินค่าเช่าห้อง',
    invoice_type: 'custom',
    doc_day: '1',
    billing_month: '',
    billing_year_be: '',
    tenant_name: '',
    room_number: '',
    room_rate: '',
    water_prev: '',
    water_curr: '',
    water_unit_price: '',
    water_total: '',
    electric_prev: '',
    electric_curr: '',
    electric_unit_price: '',
    electric_total: '',
    other_description: '',
    other_amount: '',
    total_amount: '',
    is_blank: true
  };
}

// Logs State
const logs = ref([]);
const logGroupMode = ref('room');
const logFilter = reactive({
  room_number: '',
  tenant_name: '',
  action_type: ''
});

// Room Modal State
const roomModal = reactive({
  show: false,
  form: {}
});

// Filtered Tenants for Tenant Database View
const filteredTenants = computed(() => {
  const q = tenantSearch.value.trim().toLowerCase();
  return tenants.value.filter((t) => {
    if (tenantStatusFilter.value === 'active' && !t.is_active) return false;
    if (tenantStatusFilter.value === 'inactive' && t.is_active) return false;
    if (!q) return true;
    const matchName = (t.name || '').toLowerCase().includes(q);
    const matchRoom = (t.room_number || '').toLowerCase().includes(q);
    const matchPhone = (t.phone || '').toLowerCase().includes(q);
    const matchIdCard = (t.id_card || '').toLowerCase().includes(q);
    const matchStays = (t.stays || []).some((s) => (s.room_number || '').toLowerCase().includes(q) || (s.previous_room_number || '').toLowerCase().includes(q));
    return matchName || matchRoom || matchPhone || matchIdCard || matchStays;
  });
});

function findTenantObj(id) {
  return tenants.value.find((t) => t.id === id);
}

// Computed for Monthly Batch
const selectedMonthlyInvoices = computed(() =>
  monthlyDrafts.value.filter((d) => d.selected)
);

const allMonthlySelected = computed({
  get: () => monthlyDrafts.value.length > 0 && monthlyDrafts.value.every((d) => d.selected),
  set: (val) => {
    monthlyDrafts.value.forEach((d) => { d.selected = val; });
  }
});

function toggleSelectAllMonthly(e) {
  const checked = e.target.checked;
  monthlyDrafts.value.forEach((d) => { d.selected = checked; });
}

const totalMonthlyBatchAmount = computed(() =>
  selectedMonthlyInvoices.value.reduce((acc, item) => acc + Number(item.total_amount || 0), 0)
);

const monthlyA4Sheets = computed(() => {
  const list = selectedMonthlyInvoices.value;
  const sheets = [];
  for (let i = 0; i < list.length; i += 2) {
    sheets.push({
      top: list[i],
      bottom: list[i + 1] ? list[i + 1] : createBlankDoc()
    });
  }
  return sheets;
});

function recalculateRow(item) {
  if (item.water_calc_type === 'meter') {
    const prev = parseFloat(item.water_prev);
    const curr = parseFloat(item.water_curr);
    const units = (!isNaN(prev) && !isNaN(curr) && curr >= prev) ? (curr - prev) : 0;
    item.water_units = units;
    const rate = Number(item.water_unit_price ?? settings.default_water_rate ?? 10);
    item.water_unit_price = rate;
    item.water_total = units * rate;
  } else if (item.water_calc_type === 'per_person') {
    item.water_units = 0;
    item.water_unit_price = '';
    const occ = Math.max(1, Number(item.occupant_count || 1));
    item.water_total = occ * Number(settings.default_water_per_person || 100);
  } else {
    item.water_units = 0;
    item.water_unit_price = '';
  }

  const ePrev = parseFloat(item.electric_prev);
  const eCurr = parseFloat(item.electric_curr);
  const eUnits = (!isNaN(ePrev) && !isNaN(eCurr) && eCurr >= ePrev) ? (eCurr - ePrev) : 0;
  item.electric_units = eUnits;
  const eRate = Number(item.electric_unit_price ?? settings.default_electric_rate ?? 8);
  item.electric_total = eUnits * eRate;

  recalculateTotalOnly(item);
}

function recalculateTotalOnly(item) {
  const room = Number(item.room_rate || 0);
  const water = Number(item.water_total || 0);
  const elec = Number(item.electric_total || 0);
  const other = Number(item.other_amount || 0);
  const deduct = Number(item.deposit_deduction || 0);
  item.total_amount = room + water + elec + other - deduct;
  item.baht_text = toThaiBahtText(item.total_amount);
}

function toggleMoveOutDeduction(item) {
  item.is_move_out = !item.is_move_out;
  if (item.is_move_out) {
    item.deposit_deduction = 2500;
    if (!item.other_description) item.other_description = 'หักค่ามัดจำ  2500';
  } else {
    item.deposit_deduction = 0;
    if (item.other_description === 'หักค่ามัดจำ  2500') item.other_description = '';
  }
  recalculateTotalOnly(item);
}

function carryOverMetersForNewMonth() {
  monthlyDrafts.value.forEach((item) => {
    item.id = null;
    item.invoice_number = null;
    if (item.water_calc_type === 'meter' && item.water_curr) {
      item.water_prev = item.water_curr;
    }
    if (item.electric_curr) {
      item.electric_prev = item.electric_curr;
    }
    item.is_move_out = false;
    item.deposit_deduction = 0;
    item.other_description = '';
    recalculateRow(item);
  });
  showToast('ดึงเลขมิเตอร์หลังจดมาตั้งต้นเป็นเลขจดครั้งก่อนเรียบร้อยแล้ว');
}

// API Loaders
async function loadSettings() {
  const res = await fetch('/api/settings');
  if (res.ok) {
    const data = await res.json();
    Object.assign(settings, data);
  }
}

async function loadRooms() {
  const res = await fetch('/api/rooms');
  if (res.ok) {
    rooms.value = await res.json();
  }
}

async function loadTenants() {
  const res = await fetch('/api/tenants');
  if (res.ok) {
    tenants.value = await res.json();
  }
}

async function loadAccounting() {
  const params = new URLSearchParams({
    billing_month: dashFilter.month,
    billing_year_be: String(dashFilter.year_be)
  });
  const res = await fetch(`/api/accounting?${params.toString()}`);
  if (res.ok) {
    accountingList.value = await res.json();
  }
}

async function onDashPeriodChange() {
  await Promise.all([loadDashboard(), loadAccounting()]);
}

async function loadMonthlyInvoices() {
  const params = new URLSearchParams({
    billing_month: batchPeriod.billing_month,
    billing_year_be: String(batchPeriod.billing_year_be),
    invoice_type: 'monthly'
  });
  const res = await fetch(`/api/invoices?${params.toString()}`);
  const existingInvoices = res.ok ? await res.json() : [];

  const invByRoom = {};
  for (const inv of existingInvoices) {
    invByRoom[inv.room_number] = inv;
  }

  monthlyDrafts.value = rooms.value.map((r) => {
    const existing = invByRoom[r.room_number];
    if (existing) {
      return {
        ...existing,
        selected: true,
        is_blank: false
      };
    }
    const occ = r.active_tenant?.occupant_count || 1;
    const wTotal = r.water_calc_type === 'per_person'
      ? occ * Number(settings.default_water_per_person || 100)
      : (r.water_calc_type === 'flat' ? Number(r.water_flat_amount || 100) : 0);
    const total = Number(r.monthly_rate || 0) + wTotal;
    return {
      id: null,
      selected: true,
      room_id: r.id,
      tenant_id: r.active_tenant?.id || null,
      room_number: r.room_number,
      tenant_name: r.active_tenant?.name || '',
      invoice_type: 'monthly',
      doc_day: batchPeriod.doc_day,
      billing_month: batchPeriod.billing_month,
      billing_year_be: batchPeriod.billing_year_be,
      room_rate: Number(r.monthly_rate || 2500),
      water_calc_type: r.water_calc_type,
      water_prev: r.latest_water_meter || '',
      water_curr: r.latest_water_meter || '',
      water_units: 0,
      water_unit_price: r.water_calc_type === 'meter' ? Number(r.water_rate || 10) : '',
      occupant_count: occ,
      water_total: wTotal,
      electric_prev: r.latest_electric_meter || '',
      electric_curr: r.latest_electric_meter || '',
      electric_units: 0,
      electric_unit_price: Number(r.electric_rate || 8),
      electric_total: 0,
      other_description: '',
      other_amount: 0,
      deposit_deduction: 0,
      is_move_out: false,
      total_amount: total,
      baht_text: toThaiBahtText(total),
      is_blank: false
    };
  });
}

async function onChangeBatchPeriod() {
  await loadMonthlyInvoices();
}

async function saveAllMonthlyInvoices() {
  savingBatch.value = true;
  try {
    const items = selectedMonthlyInvoices.value.map((d) => ({
      ...d,
      doc_day: batchPeriod.doc_day,
      billing_month: batchPeriod.billing_month,
      billing_year_be: batchPeriod.billing_year_be
    }));
    const res = await fetch('/api/invoices/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    if (!res.ok) throw new Error('บันทึกไม่สำเร็จ');
    const result = await res.json();
    showToast(`บันทึกใบเสร็จรายเดือนสำเร็จ ${result.saved_count} ห้อง พร้อมเก็บ Log ประวัติแล้ว!`);
    await Promise.all([loadRooms(), loadTenants(), loadMonthlyInvoices(), loadDashboard(), loadLogs()]);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    savingBatch.value = false;
  }
}

// Daily / Custom Receipt Helpers
function openSingleInDailyEditor(item) {
  customPair.top = JSON.parse(JSON.stringify({ ...item, is_blank: false }));
  activeTab.value = 'daily';
  showToast(`เปิดใบเสร็จห้อง ${item.room_number} (${item.tenant_name}) ในโหมดแก้ไขใบเดี่ยวแล้ว`);
}

function setCustomSlotMode(slot, mode) {
  if (mode === 'blank') {
    customPair[slot] = createBlankDoc();
  } else {
    customPair[slot] = createDefaultDoc('daily');
  }
}

function copyTopToBottom() {
  customPair.bottom = JSON.parse(JSON.stringify(customPair.top));
  showToast('คัดลอกข้อมูลจากครึ่งบนลงครึ่งล่างเรียบร้อยแล้ว');
}

function onSelectRoomForCustom(slot, roomNumber) {
  const target = customPair[slot];
  if (!roomNumber) return;
  const r = rooms.value.find((rm) => rm.room_number === roomNumber);
  if (!r) return;

  target.is_blank = false;
  target.room_id = r.id;
  target.tenant_id = r.active_tenant?.id || null;
  target.room_number = r.room_number;
  target.tenant_name = r.active_tenant?.name || '';
  target.water_calc_type = r.water_calc_type;
  target.water_prev = r.latest_water_meter || '';
  target.water_curr = r.latest_water_meter || '';
  target.electric_prev = r.latest_electric_meter || '';
  target.electric_curr = r.latest_electric_meter || '';
  target.electric_unit_price = r.electric_rate || 8;
  target.daily_rate = r.daily_rate || 350;

  if (target.invoice_type === 'daily') {
    calcDailyCustom(slot);
  } else {
    target.room_rate = r.monthly_rate || 2500;
    target.line1_label = `ค่าห้องเดือน...${target.billing_month}`;
    recalculateRow(target);
  }
}

function onCustomTypeChange(slot) {
  const target = customPair[slot];
  if (target.invoice_type === 'daily') {
    applyDailyTemplate(slot);
  } else {
    target.line1_label = `ค่าห้องเดือน...${target.billing_month}`;
  }
}

function calcDailyCustom(slot) {
  const target = customPair[slot];
  const days = Math.max(1, Number(target.days_count || 1));
  const rate = Number(target.daily_rate || 350);
  target.room_rate = days * rate;
  target.line1_label = `ค่าห้องพักรายวัน (${days} คืน)...`;
  target.line1_unit_price = String(rate);
  recalculateTotalOnly(target);
}

function applyDailyTemplate(slot) {
  const target = customPair[slot];
  target.is_blank = false;
  target.invoice_type = 'daily';
  target.days_count = target.days_count || 1;
  target.daily_rate = target.daily_rate || 350;
  target.water_total = 0;
  target.electric_total = 0;
  target.water_unit_price = '';
  target.electric_unit_price = '';
  target.line2_label = 'จำนวนเลขมาตรวัดน้ำ (จดครั้งก่อน)...-';
  target.line3_label = 'จำนวนเลขมาตรวัดน้ำ (หลังจดน้ำ)...-';
  target.line4_label = 'จำนวนเลขมาตรวัดไฟ (จดครั้งก่อน)...-';
  target.line5_label = 'จำนวนเลขมาตรวัดไฟ (หลังจดไฟ)...-';
  calcDailyCustom(slot);
}

function applyMoveOutTemplate(slot) {
  const target = customPair[slot];
  target.is_blank = false;
  target.is_move_out = true;
  target.deposit_deduction = 2500;
  target.other_description = 'หักค่ามัดจำ  2500';
  recalculateTotalOnly(target);
}

async function saveCustomDailyReceipts() {
  try {
    const slots = ['top', 'bottom'];
    let count = 0;
    for (const s of slots) {
      const doc = customPair[s];
      if (!doc.is_blank && (doc.tenant_name || doc.room_number)) {
        await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(doc)
        });
        count++;
      }
    }
    showToast(`บันทึกใบเสร็จ (${count} ใบ) และเก็บประวัติเรียบร้อยแล้ว`);
    await Promise.all([loadDashboard(), loadLogs(), loadRooms(), loadTenants()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Dashboard & Logs Loaders
async function loadDashboard() {
  const params = new URLSearchParams({
    month: dashFilter.month,
    year_be: String(dashFilter.year_be)
  });
  const res = await fetch(`/api/dashboard?${params.toString()}`);
  if (res.ok) {
    dashboard.value = await res.json();
  }
}

async function loadLogs() {
  const params = new URLSearchParams();
  if (logFilter.room_number) params.set('room_number', logFilter.room_number);
  if (logFilter.tenant_name) params.set('tenant_name', logFilter.tenant_name);
  if (logFilter.action_type) params.set('action_type', logFilter.action_type);

  const res = await fetch(`/api/logs?${params.toString()}`);
  if (res.ok) {
    logs.value = await res.json();
  }
}

function resetLogFilter() {
  logFilter.room_number = '';
  logFilter.tenant_name = '';
  logFilter.action_type = '';
  loadLogs();
}

function viewRoomHistory(roomNumber) {
  logFilter.room_number = roomNumber;
  logFilter.tenant_name = '';
  logGroupMode.value = 'room';
  activeTab.value = 'logs';
  loadLogs();
}

const groupedLogs = computed(() => {
  const map = new Map();
  for (const log of logs.value) {
    const key = logGroupMode.value === 'room'
      ? (log.room_number || 'ไม่ระบุห้อง')
      : (log.tenant_name || 'ไม่ระบุผู้เช่า');
    if (!map.has(key)) {
      map.set(key, {
        key,
        subtitle: logGroupMode.value === 'room'
          ? `ผู้เช่าล่าสุด: ${log.tenant_name || '-'}`
          : `หมายเลขห้อง: ${log.room_number || '-'}`,
        totalAmount: 0,
        items: []
      });
    }
    const g = map.get(key);
    g.items.push(log);
    if (log.amount) g.totalAmount += Number(log.amount);
  }
  return Array.from(map.values());
});

// Tenant Profile & Stay Transfer Actions
function openTenantByRoom(room) {
  const t = findTenantObj(room.active_tenant?.id);
  if (t) {
    openTenantProfileModal(t);
  }
}

function openTenantProfileModal(tenant = null) {
  if (tenant) {
    tenantModal.form = {
      id: tenant.id,
      room_id: tenant.room_id,
      room_number: tenant.room_number,
      name: tenant.name,
      phone: tenant.phone || '',
      id_card: tenant.id_card || '',
      id_card_image_url: tenant.id_card_image_url || null,
      house_reg_image_url: tenant.house_reg_image_url || null,
      home_address: tenant.home_address || '',
      emergency_contact: tenant.emergency_contact || '',
      rental_type: tenant.rental_type || 'monthly',
      occupant_count: tenant.occupant_count || 1,
      deposit_amount: tenant.deposit_amount || 2500,
      check_in_date: tenant.check_in_date || new Date().toISOString().slice(0, 10),
      is_active: tenant.is_active !== false,
      notes: tenant.notes || ''
    };
  } else {
    const firstRoom = rooms.value[0];
    tenantModal.form = {
      id: null,
      room_id: firstRoom?.id || null,
      room_number: firstRoom?.room_number || '320',
      name: '',
      phone: '',
      id_card: '',
      id_card_image_url: null,
      house_reg_image_url: null,
      home_address: '',
      emergency_contact: '',
      rental_type: 'monthly',
      occupant_count: 1,
      deposit_amount: 2500,
      check_in_date: new Date().toISOString().slice(0, 10),
      is_active: true,
      notes: ''
    };
  }
  tenantModal.show = true;
}

function onTenantModalRoomSelect() {
  const r = rooms.value.find((rm) => rm.room_number === tenantModal.form.room_number);
  if (r) tenantModal.form.room_id = r.id;
}

function onUploadTenantDoc(e, field) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    tenantModal.form[field] = reader.result;
  };
  reader.readAsDataURL(file);
}

async function saveTenantProfileModal() {
  const f = tenantModal.form;
  if (!f.name) {
    showToast('กรุณาระบุชื่อผู้เช่า', 'error');
    return;
  }
  const url = f.id ? `/api/tenants/${f.id}` : '/api/tenants';
  const method = f.id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f)
  });
  if (res.ok) {
    tenantModal.show = false;
    showToast('บันทึกแฟ้มประวัติลูกค้าและเอกสารเรียบร้อยแล้ว');
    await Promise.all([loadTenants(), loadRooms(), loadLogs()]);
  } else {
    showToast('บันทึกข้อมูลไม่สำเร็จ', 'error');
  }
}

function openTransferModal(tenant) {
  transferModal.tenant = tenant;
  transferModal.form = {
    event_type: 'room_transfer',
    new_room_number: tenant.room_number,
    event_date: new Date().toISOString().slice(0, 10),
    rate_amount: 2500,
    deposit_amount: tenant.deposit_amount || 2500,
    notes: ''
  };
  transferModal.show = true;
}

async function submitRoomTransfer() {
  const t = transferModal.tenant;
  if (!t) return;
  const res = await fetch(`/api/tenants/${t.id}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(transferModal.form)
  });
  if (res.ok) {
    transferModal.show = false;
    showToast(`บันทึกประวัติการย้ายห้อง/เข้าพักของ "${t.name}" เรียบร้อยแล้ว`);
    await Promise.all([loadTenants(), loadRooms(), loadMonthlyInvoices(), loadLogs()]);
  } else {
    showToast('เกิดข้อผิดพลาดในการบันทึกประวัติย้ายห้อง', 'error');
  }
}

function previewDocumentImage(url, title) {
  docPreview.url = url;
  docPreview.title = title;
  docPreview.show = true;
}

// Accounting Actions
function openAccountingModal(tx = null) {
  if (tx) {
    accModal.form = { ...tx };
  } else {
    accModal.form = {
      id: null,
      tx_type: 'expense',
      cost_nature: 'direct',
      category: 'ค่าซ่อมบำรุงห้องพัก',
      title: '',
      description: '',
      amount: 500,
      tx_date: new Date().toISOString().slice(0, 10),
      billing_month: dashFilter.month,
      billing_year_be: dashFilter.year_be,
      room_number: 'ส่วนกลาง',
      vendor_or_payee: '',
      payment_method: 'โอนเงิน',
      reference_doc: ''
    };
  }
  accModal.show = true;
}

async function saveAccountingModal() {
  const f = accModal.form;
  if (!f.title || !f.amount) {
    showToast('กรุณากรอกหัวข้อรายการและจำนวนเงิน', 'error');
    return;
  }
  const res = await fetch('/api/accounting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f)
  });
  if (res.ok) {
    accModal.show = false;
    showToast('บันทึกรายการบัญชีรายรับ-รายจ่ายเรียบร้อยแล้ว');
    await Promise.all([loadAccounting(), loadDashboard(), loadLogs()]);
  } else {
    showToast('บันทึกรายการบัญชีไม่สำเร็จ', 'error');
  }
}

async function deleteAccountingTx(id) {
  const res = await fetch(`/api/accounting/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('ลบรายการบัญชีเรียบร้อยแล้ว');
    await Promise.all([loadAccounting(), loadDashboard(), loadLogs()]);
  }
}

// Room Modal Actions
function openRoomModal(room = null) {
  if (room) {
    roomModal.form = {
      id: room.id,
      room_number: room.room_number,
      zone: room.zone,
      rental_type: room.rental_type,
      monthly_rate: room.monthly_rate,
      daily_rate: room.daily_rate,
      water_calc_type: room.water_calc_type,
      water_rate: room.water_rate,
      water_flat_amount: room.water_flat_amount,
      electric_rate: room.electric_rate,
      latest_water_meter: room.latest_water_meter,
      latest_electric_meter: room.latest_electric_meter,
      tenant_name: room.active_tenant?.name || '',
      occupant_count: room.active_tenant?.occupant_count || 1,
      deposit_amount: room.active_tenant?.deposit_amount || 2500
    };
  } else {
    roomModal.form = {
      id: null,
      room_number: '',
      zone: 'ชั้น 1',
      rental_type: 'monthly',
      monthly_rate: 2500,
      daily_rate: 350,
      water_calc_type: 'per_person',
      water_rate: 10,
      water_flat_amount: 100,
      electric_rate: 8,
      latest_water_meter: '',
      latest_electric_meter: '',
      tenant_name: '',
      occupant_count: 1,
      deposit_amount: 2500
    };
  }
  roomModal.show = true;
}

async function saveRoomModal() {
  const f = roomModal.form;
  if (!f.room_number) {
    showToast('กรุณาระบุหมายเลขห้อง', 'error');
    return;
  }
  const url = f.id ? `/api/rooms/${f.id}` : '/api/rooms';
  const method = f.id ? 'PUT' : 'POST';
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(f)
  });
  if (res.ok) {
    roomModal.show = false;
    showToast('บันทึกข้อมูลห้องพักและผู้เช่าเรียบร้อยแล้ว');
    await Promise.all([loadRooms(), loadTenants(), loadMonthlyInvoices(), loadDashboard(), loadLogs()]);
  } else {
    showToast('เกิดข้อผิดพลาดในการบันทึกห้องพัก', 'error');
  }
}

// Settings Actions
function onUploadQrCode(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    settings.qr_code_url = reader.result;
  };
  reader.readAsDataURL(file);
}

async function savePaymentSettings() {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  if (res.ok) {
    showToast('บันทึกข้อมูลการโอนเงินและ QR Code เรียบร้อยแล้ว');
    await loadLogs();
  } else {
    showToast('บันทึกการตั้งค่าไม่สำเร็จ', 'error');
  }
}

async function onReactNotebookSynced() {
  await Promise.all([loadRooms(), loadMonthlyInvoices(), loadDashboard(), loadLogs()]);
}

function triggerPrint() {
  window.print();
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
}

onMounted(async () => {
  await Promise.all([loadSettings(), loadRooms(), loadTenants()]);
  await Promise.all([loadMonthlyInvoices(), loadDashboard(), loadAccounting(), loadLogs()]);
});
</script>
