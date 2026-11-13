import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('🌱 Starting database seed into Supabase...');
  const qrB64 = fs.readFileSync(path.join(rootDir, 'extracted_media/qr_b64.txt'), 'utf-8').trim();
  const records = JSON.parse(fs.readFileSync(path.join(rootDir, 'extracted_media/seed_records.json'), 'utf-8'));

  // Clear existing data
  await supabase.from('history_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('tenants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('rooms').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('payment_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  // 1. Insert Payment Settings
  const { error: setErr } = await supabase.from('payment_settings').insert({
    dorm_name: 'หอพักเอมอร',
    receipt_title: 'ใบเสร็จรับเงินค่าเช่าห้อง',
    bank_name: 'ธ.ก.ส.',
    account_number: '017562024411',
    account_holder: 'นาง เอมอร ไทยนอ',
    qr_code_url: qrB64,
    qr_caption: 'นาง เอมอร ไทยนอ',
    default_water_rate: 10,
    default_water_per_person: 100,
    default_electric_rate: 8
  });
  if (setErr) throw setErr;
  console.log('✅ Payment settings & QR Code seeded.');

  // 2. Insert Rooms, Tenants, Invoices, History Logs
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const idx = i + 1;
    const rm = r.room_number;
    const tname = r.tenant_name;
    const zone = rm.startsWith('320') ? 'โซนบ้านพัก 320' : (rm.startsWith('1') ? 'ชั้น 1' : 'ชั้น 2');
    const wCalc = r.water_prev !== '' ? 'meter' : 'per_person';
    const occ = wCalc === 'meter' ? 1 : Math.max(1, Math.round(r.water_total / 100));
    const wRate = 10;
    const wFlat = wCalc !== 'meter' ? r.water_total : 100;
    const eRate = r.elec_rate || 8;
    const isMoveOut = (r.other_desc || '').includes('หักค่ามัดจำ');
    const depDeduct = isMoveOut ? 2500 : 0;
    const invNo = `INV-256911-${String(idx).padStart(3, '0')}`;

    const { data: roomData, error: roomErr } = await supabase.from('rooms').insert({
      room_number: rm,
      zone,
      sort_order: idx,
      rental_type: 'monthly',
      monthly_rate: r.room_rate,
      daily_rate: 350,
      water_calc_type: wCalc,
      water_rate: wRate,
      water_flat_amount: wFlat,
      electric_rate: eRate,
      latest_water_meter: r.water_curr || '',
      latest_electric_meter: r.elec_curr || '',
      status: 'occupied'
    }).select().single();
    if (roomErr) throw roomErr;

    const { data: tenantData, error: tenantErr } = await supabase.from('tenants').insert({
      room_id: roomData.id,
      room_number: rm,
      name: tname,
      rental_type: 'monthly',
      occupant_count: occ,
      deposit_amount: 2500,
      is_active: true
    }).select().single();
    if (tenantErr) throw tenantErr;

    const { data: invData, error: invErr } = await supabase.from('invoices').insert({
      invoice_number: invNo,
      room_id: roomData.id,
      tenant_id: tenantData.id,
      room_number: rm,
      tenant_name: tname,
      invoice_type: 'monthly',
      doc_day: String(r.day || '1'),
      billing_month: r.month || 'พฤศจิกายน',
      billing_month_num: 11,
      billing_year_be: r.year || 2569,
      room_rate: r.room_rate,
      room_rate_label: `ค่าห้องเดือน...${r.month || 'พฤศจิกายน'}`,
      days_count: 1,
      water_calc_type: wCalc,
      water_prev: r.water_prev || '',
      water_curr: r.water_curr || '',
      water_units: r.water_units || 0,
      water_unit_price: wCalc === 'meter' ? 10 : null,
      occupant_count: occ,
      water_total: r.water_total,
      electric_prev: r.elec_prev || '',
      electric_curr: r.elec_curr || '',
      electric_units: r.elec_units || 0,
      electric_unit_price: eRate,
      electric_total: r.elec_total,
      other_description: r.other_desc || '',
      other_amount: 0,
      deposit_deduction: depDeduct,
      is_move_out: isMoveOut,
      total_amount: r.total,
      baht_text: r.baht_text || '',
      status: 'paid',
      bank_name_snapshot: 'ธ.ก.ส.',
      account_number_snapshot: '017562024411',
      account_holder_snapshot: 'นาง เอมอร ไทยนอ',
      qr_caption_snapshot: 'นาง เอมอร ไทยนอ'
    }).select().single();
    if (invErr) throw invErr;

    const { error: logErr } = await supabase.from('history_logs').insert({
      action_type: isMoveOut ? 'MOVE_OUT_DEDUCTION' : 'INVOICE_CREATED',
      room_id: roomData.id,
      room_number: rm,
      tenant_id: tenantData.id,
      tenant_name: tname,
      invoice_id: invData.id,
      description: `ออกใบเสร็จค่าเช่าห้องประจำเดือน ${r.month} ${r.year} (ห้อง ${rm} - ${tname}) ยอดรวม ${Number(r.total).toLocaleString()} บาท${isMoveOut ? ' [หักค่ามัดจำ 2,500 บาท]' : ''}`,
      amount: r.total,
      metadata: {
        invoice_number: invNo,
        billing_month: r.month,
        billing_year_be: r.year,
        water_prev: r.water_prev,
        water_curr: r.water_curr,
        water_total: r.water_total,
        electric_prev: r.elec_prev,
        electric_curr: r.elec_curr,
        electric_total: r.elec_total,
        room_rate: r.room_rate,
        other_description: r.other_desc,
        deposit_deduction: depDeduct
      }
    });
    if (logErr) throw logErr;
  }

  console.log(`🎉 Seeded ${records.length} rooms, tenants, invoices, and history logs successfully!`);
}

seed().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
