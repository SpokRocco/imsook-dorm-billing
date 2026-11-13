<template>
  <div class="half-a4-receipt select-none" :class="{ 'ring-2 ring-amber-400/70 bg-amber-50/10': editable }">
    <!-- Header Section -->
    <div>
      <!-- Title -->
      <div class="text-center font-bold text-[19px] leading-tight tracking-wide mb-1">
        <input
          v-if="editable"
          v-model="localDoc.receipt_title"
          class="text-center font-bold text-[19px] border-b border-dashed border-amber-500 bg-amber-50/40 px-2 outline-none"
          placeholder="ใบเสร็จรับเงินค่าเช่าห้อง"
        />
        <span v-else>{{ localDoc.receipt_title || settings?.receipt_title || 'ใบเสร็จรับเงินค่าเช่าห้อง' }}</span>
      </div>

      <!-- Date Row (Right aligned like reference PDF) -->
      <div class="flex justify-end items-baseline text-[15.5px] pr-6 mb-1.5">
        <span>วันที่&nbsp;</span>
        <template v-if="editable">
          <input v-model="localDoc.doc_day" class="dotted-input w-10 text-center font-medium" />
        </template>
        <template v-else>
          <span v-if="localDoc.is_blank" class="inline-block w-8 border-b border-dotted border-black text-center">&nbsp;</span>
          <span v-else class="px-1 font-medium">{{ localDoc.doc_day || '1' }}</span>
        </template>

        <span>&nbsp;เดือน&nbsp;</span>
        <template v-if="editable">
          <input v-model="localDoc.billing_month" class="dotted-input w-28 text-center font-medium" />
        </template>
        <template v-else>
          <span v-if="localDoc.is_blank" class="inline-block w-28 border-b border-dotted border-black text-center">&nbsp;</span>
          <span v-else class="px-1 font-medium">{{ localDoc.billing_month }}</span>
        </template>

        <span>&nbsp;พ.ศ.&nbsp;</span>
        <template v-if="editable">
          <input v-model="localDoc.billing_year_be" class="dotted-input w-16 text-center font-medium" />
        </template>
        <template v-else>
          <span v-if="localDoc.is_blank" class="inline-block w-16 border-b border-dotted border-black text-center">&nbsp;</span>
          <span v-else class="px-1 font-medium">{{ localDoc.billing_year_be }}</span>
        </template>
      </div>

      <!-- Tenant Name & Room Number Row -->
      <div class="flex items-baseline text-[15.5px] mb-2 pl-4 pr-4">
        <span class="shrink-0">ชื่อ</span>
        <div class="flex-1 border-b border-dotted border-black mx-1 text-left pl-6 font-medium min-h-[22px]">
          <input
            v-if="editable"
            v-model="localDoc.tenant_name"
            class="w-full bg-amber-50/40 outline-none px-1 font-medium"
            placeholder="ระบุชื่อผู้เช่า..."
          />
          <span v-else>{{ localDoc.is_blank ? '' : localDoc.tenant_name }}</span>
        </div>
        <span class="shrink-0 ml-1">หมายเลขห้อง</span>
        <div
          class="min-w-[90px] text-left pl-2 font-semibold"
          :class="{ 'border-b border-dotted border-black': localDoc.is_blank || editable }"
        >
          <input
            v-if="editable"
            v-model="localDoc.room_number"
            class="w-24 bg-amber-50/40 outline-none px-1 font-semibold"
            placeholder="เลขห้อง"
          />
          <span v-else>{{ localDoc.is_blank ? '' : localDoc.room_number }}</span>
        </div>
      </div>

      <!-- Main Table -->
      <table class="receipt-table text-[15px]">
        <thead>
          <tr class="h-[30px]">
            <th class="w-[68%]">รายการ</th>
            <th class="w-[15%]">หน่วยละ</th>
            <th class="w-[17%]">จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody class="align-top">
          <!-- Line 1: Room Rate -->
          <tr class="h-[27px]">
            <td class="px-2.5 pt-1">
              <div class="flex items-baseline">
                <template v-if="editable">
                  <input
                    v-model="localDoc.line1_label"
                    class="w-full bg-amber-50/40 border-b border-dashed border-amber-400 outline-none px-1"
                  />
                </template>
                <template v-else>
                  <span v-if="localDoc.custom_line1">{{ localDoc.custom_line1 }}</span>
                  <span v-else-if="localDoc.is_blank">
                    ค่าห้องเดือน..................................................
                  </span>
                  <span v-else>
                    ค่าห้องเดือน...{{ localDoc.billing_month }}
                  </span>
                </template>
              </div>
            </td>
            <td class="text-center pt-1">
              <input
                v-if="editable"
                v-model="localDoc.line1_unit_price"
                class="w-16 text-center bg-amber-50/40 border-b border-dashed border-amber-400 outline-none"
              />
              <span v-else>{{ localDoc.line1_unit_price || '' }}</span>
            </td>
            <td class="text-right pr-4 pt-1 font-medium">
              <input
                v-if="editable"
                v-model.number="localDoc.room_rate"
                type="number"
                @input="recalcIfEditable"
                class="w-20 text-right bg-amber-50/40 border-b border-dashed border-amber-400 outline-none"
              />
              <span v-else>{{ localDoc.is_blank ? '' : formatPlainOrComma(localDoc.room_rate, false) }}</span>
            </td>
          </tr>

          <!-- Line 2: Water Meter Previous -->
          <tr class="h-[26px]">
            <td class="px-2.5">
              <template v-if="editable">
                <input
                  v-model="localDoc.line2_label"
                  class="w-full bg-amber-50/40 border-b border-dashed border-amber-400 outline-none px-1"
                />
              </template>
              <template v-else>
                <span v-if="localDoc.is_blank">
                  จำนวนเลขมาตรวัดน้ำ (จดครั้งก่อน).........................................................................
                </span>
                <span v-else>
                  จำนวนเลขมาตรวัดน้ำ (จดครั้งก่อน)...{{ localDoc.water_prev || '' }}
                </span>
              </template>
            </td>
            <td class="text-center"></td>
            <td class="text-right pr-4"></td>
          </tr>

          <!-- Line 3: Water Meter Current + Water Rate + Water Total -->
          <tr class="h-[26px]">
            <td class="px-2.5">
              <template v-if="editable">
                <input
                  v-model="localDoc.line3_label"
                  class="w-full bg-amber-50/40 border-b border-dashed border-amber-400 outline-none px-1"
                />
              </template>
              <template v-else>
                <span v-if="localDoc.is_blank">
                  จำนวนเลขมาตรวัดน้ำ (หลังจดน้ำ)...........................................................................
                </span>
                <span v-else>
                  จำนวนเลขมาตรวัดน้ำ (หลังจดน้ำ)...{{ localDoc.water_curr || '' }}
                </span>
              </template>
            </td>
            <td class="text-center">
              <input
                v-if="editable"
                v-model="localDoc.water_unit_price"
                class="w-16 text-center bg-amber-50/40 border-b border-dashed border-amber-400 outline-none"
                placeholder="-"
              />
              <span v-else>{{ localDoc.is_blank ? '' : (localDoc.water_calc_type === 'meter' ? (localDoc.water_unit_price ?? 10) : (localDoc.water_unit_price || '')) }}</span>
            </td>
            <td class="text-right pr-4 font-medium">
              <input
                v-if="editable"
                v-model.number="localDoc.water_total"
                type="number"
                @input="recalcIfEditable"
                class="w-20 text-right bg-amber-50/40 border-b border-dashed border-amber-400 outline-none"
              />
              <span v-else>{{ localDoc.is_blank ? '' : formatPlainOrComma(localDoc.water_total, false) }}</span>
            </td>
          </tr>

          <!-- Line 4: Electric Meter Previous -->
          <tr class="h-[26px]">
            <td class="px-2.5">
              <template v-if="editable">
                <input
                  v-model="localDoc.line4_label"
                  class="w-full bg-amber-50/40 border-b border-dashed border-amber-400 outline-none px-1"
                />
              </template>
              <template v-else>
                <span v-if="localDoc.is_blank">
                  จำนวนเลขมาตรวัดไฟ (จดครั้งก่อน).........................................................................
                </span>
                <span v-else>
                  จำนวนเลขมาตรวัดไฟ (จดครั้งก่อน)...{{ localDoc.electric_prev || '' }}
                </span>
              </template>
            </td>
            <td class="text-center"></td>
            <td class="text-right pr-4"></td>
          </tr>

          <!-- Line 5: Electric Meter Current + Electric Rate + Electric Total -->
          <tr class="h-[26px]">
            <td class="px-2.5">
              <template v-if="editable">
                <input
                  v-model="localDoc.line5_label"
                  class="w-full bg-amber-50/40 border-b border-dashed border-amber-400 outline-none px-1"
                />
              </template>
              <template v-else>
                <span v-if="localDoc.is_blank">
                  จำนวนเลขมาตรวัดไฟ (หลังจดไฟ)...........................................................................
                </span>
                <span v-else>
                  จำนวนเลขมาตรวัดไฟ (หลังจดไฟ)...{{ localDoc.electric_curr || '' }}
                </span>
              </template>
            </td>
            <td class="text-center">
              <input
                v-if="editable"
                v-model="localDoc.electric_unit_price"
                class="w-16 text-center bg-amber-50/40 border-b border-dashed border-amber-400 outline-none"
              />
              <span v-else>{{ localDoc.is_blank ? '' : (localDoc.electric_unit_price ?? 8) }}</span>
            </td>
            <td class="text-right pr-4 font-medium">
              <input
                v-if="editable"
                v-model.number="localDoc.electric_total"
                type="number"
                @input="recalcIfEditable"
                class="w-20 text-right bg-amber-50/40 border-b border-dashed border-amber-400 outline-none"
              />
              <span v-else>{{ localDoc.is_blank ? '' : formatPlainOrComma(localDoc.electric_total, false) }}</span>
            </td>
          </tr>

          <!-- Line 6: Other Charges / Deposit Deduction / Move-out note -->
          <tr class="h-[34px]">
            <td class="px-2.5 pb-1.5">
              <div class="flex items-baseline">
                <span class="shrink-0">ค่าอื่นๆ</span>
                <div class="flex-1 border-b border-dotted border-black ml-1 pl-2 font-medium min-h-[20px]">
                  <input
                    v-if="editable"
                    v-model="localDoc.other_description"
                    class="w-full bg-amber-50/40 outline-none px-1"
                    placeholder="เช่น หักค่ามัดจำ 2500 / ค่าทำความสะอาด..."
                  />
                  <span v-else>{{ localDoc.is_blank ? '' : (localDoc.other_description || '') }}</span>
                </div>
              </div>
            </td>
            <td class="text-center pb-1.5"></td>
            <td class="text-right pr-4 pb-1.5 font-medium">
              <input
                v-if="editable"
                v-model="localDoc.other_amount_display"
                class="w-20 text-right bg-amber-50/40 border-b border-dashed border-amber-400 outline-none"
                placeholder=""
              />
              <span v-else>{{ (!localDoc.is_blank && localDoc.other_amount && Number(localDoc.other_amount) !== 0) ? formatPlainOrComma(localDoc.other_amount, false) : '' }}</span>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="h-[32px]">
            <td class="px-2.5 text-[15.5px] font-bold">รวมเป็นเงิน</td>
            <td></td>
            <td class="text-right pr-3 text-[15.5px] font-bold">
              <input
                v-if="editable"
                v-model.number="localDoc.total_amount"
                type="number"
                class="w-24 text-right bg-amber-50/60 border-b border-dashed border-amber-500 outline-none font-bold"
              />
              <span v-else>{{ localDoc.is_blank ? '' : formatNumber(localDoc.total_amount) }}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Footer Section: Bank Info & QR Code -->
    <div class="flex justify-between items-start pt-1.5 px-1">
      <!-- Left: Bank Transfer Text -->
      <div class="text-[16.5px] font-bold leading-relaxed pt-0.5">
        <div class="flex items-center gap-3">
          <span>โอนเลขบัญชี :</span>
          <span>{{ localDoc.bank_name_snapshot || settings?.bank_name || 'ธ.ก.ส.' }}</span>
          <span class="tracking-wide">{{ localDoc.account_number_snapshot || settings?.account_number || '017562024411' }}</span>
        </div>
        <div class="pl-[105px] mt-0.5">
          {{ localDoc.account_holder_snapshot || settings?.account_holder || 'นาง เอมอร ไทยนอ' }}
        </div>
      </div>

      <!-- Right: QR Code & Name Box -->
      <div class="flex items-center gap-2 pr-8">
        <div class="flex flex-col items-center">
          <div v-if="qrUrl" class="w-[74px] h-[74px] flex items-center justify-center bg-white p-0.5">
            <img :src="qrUrl" alt="QR Code" class="w-full h-full object-contain" />
          </div>
          <div v-else class="w-[74px] h-[74px] border border-dashed border-slate-400 flex items-center justify-center text-[10px] text-slate-400">
            QR Code
          </div>
          <!-- Boxed Name Below or Next to QR matching reference PDF -->
          <div class="border border-black px-2.5 py-0.5 mt-1 text-[12px] font-semibold leading-tight bg-white whitespace-nowrap">
            {{ localDoc.qr_caption_snapshot || settings?.qr_caption || settings?.account_holder || 'นาง เอมอร ไทยนอ' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch, computed } from 'vue';
import { formatNumber } from '../utils/bahtText.js';

const props = defineProps({
  doc: {
    type: Object,
    required: true
  },
  settings: {
    type: Object,
    default: () => ({})
  },
  editable: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:doc']);

const localDoc = reactive({
  receipt_title: 'ใบเสร็จรับเงินค่าเช่าห้อง',
  doc_day: '1',
  billing_month: 'พฤศจิกายน',
  billing_year_be: 2569,
  tenant_name: '',
  room_number: '',
  room_rate: 0,
  water_calc_type: 'meter',
  water_prev: '',
  water_curr: '',
  water_unit_price: 10,
  water_total: 0,
  electric_prev: '',
  electric_curr: '',
  electric_unit_price: 8,
  electric_total: 0,
  other_description: '',
  other_amount: 0,
  other_amount_display: '',
  deposit_deduction: 0,
  total_amount: 0,
  is_blank: false,
  line1_label: '',
  line1_unit_price: '',
  line2_label: '',
  line3_label: '',
  line4_label: '',
  line5_label: '',
  ...props.doc
});

function syncLabelsFromDoc(d) {
  Object.assign(localDoc, d);
  if (!d.line1_label) {
    localDoc.line1_label = d.is_blank
      ? 'ค่าห้องเดือน..................................................'
      : (d.custom_line1 || `ค่าห้องเดือน...${d.billing_month || ''}`);
  }
  if (!d.line2_label) {
    localDoc.line2_label = `จำนวนเลขมาตรวัดน้ำ (จดครั้งก่อน)...${d.water_prev || ''}`;
  }
  if (!d.line3_label) {
    localDoc.line3_label = `จำนวนเลขมาตรวัดน้ำ (หลังจดน้ำ)...${d.water_curr || ''}`;
  }
  if (!d.line4_label) {
    localDoc.line4_label = `จำนวนเลขมาตรวัดไฟ (จดครั้งก่อน)...${d.electric_prev || ''}`;
  }
  if (!d.line5_label) {
    localDoc.line5_label = `จำนวนเลขมาตรวัดไฟ (หลังจดไฟ)...${d.electric_curr || ''}`;
  }
}

syncLabelsFromDoc(props.doc);

watch(
  () => props.doc,
  (newVal) => {
    syncLabelsFromDoc(newVal);
  },
  { deep: true }
);

watch(
  localDoc,
  (val) => {
    emit('update:doc', { ...val });
  },
  { deep: true }
);

const qrUrl = computed(() => props.settings?.qr_code_url || '');

function recalcIfEditable() {
  const room = Number(localDoc.room_rate || 0);
  const water = Number(localDoc.water_total || 0);
  const elec = Number(localDoc.electric_total || 0);
  const other = Number(localDoc.other_amount || 0);
  const deduct = Number(localDoc.deposit_deduction || 0);
  localDoc.total_amount = room + water + elec + other - deduct;
}

function formatPlainOrComma(val, useComma = false) {
  if (val === null || val === undefined || val === '') return '';
  const n = Number(val);
  if (isNaN(n)) return val;
  return useComma ? n.toLocaleString('en-US') : String(n);
}
</script>
