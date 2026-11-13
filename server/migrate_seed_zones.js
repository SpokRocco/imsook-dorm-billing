import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { runBillAuditSubAgent } from './billAuditAgent.js';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  console.log('🔄 Updating dorm name to หอพักอิ่มสุข, syncing zones, and backfilling bill audit logs...');

  // 1. Update dorm name to หอพักอิ่มสุข
  const { data: settingsList, error: setReadErr } = await supabase.from('payment_settings').select('id, dorm_name');
  if (setReadErr) throw setReadErr;
  for (const s of settingsList || []) {
    const { error: updErr } = await supabase
      .from('payment_settings')
      .update({ dorm_name: 'หอพักอิ่มสุข', updated_at: new Date().toISOString() })
      .eq('id', s.id);
    if (updErr) throw updErr;
  }
  console.log(`✅ Updated payment_settings (${settingsList?.length || 0} row) -> หอพักอิ่มสุข`);

  // 2. Seed dorm_zones cleanly
  const defaultZones = [
    { name: 'โซนบ้านพัก 320', code: 'Z320', description: 'โซนบ้านพักเดี่ยวและห้อง 320/1 - 320/8', color_theme: 'amber', icon_name: 'Home', sort_order: 1 },
    { name: 'ชั้น 1', code: 'F1', description: 'อาคารหอพักชั้นที่ 1', color_theme: 'emerald', icon_name: 'Building2', sort_order: 2 },
    { name: 'ชั้น 2', code: 'F2', description: 'อาคารหอพักชั้นที่ 2', color_theme: 'indigo', icon_name: 'Layers', sort_order: 3 }
  ];

  for (const z of defaultZones) {
    await supabase.from('dorm_zones').upsert(z, { onConflict: 'name' });
  }

  const { data: rooms, error: roomsErr } = await supabase.from('rooms').select('*');
  if (roomsErr) throw roomsErr;

  const { data: allZones } = await supabase.from('dorm_zones').select('*');
  const zoneByName = new Map((allZones || []).map((z) => [z.name, z]));

  for (const r of rooms || []) {
    if (r.zone && !zoneByName.has(r.zone)) {
      const { data: newZ } = await supabase
        .from('dorm_zones')
        .upsert({ name: r.zone, code: 'Z', description: `โซน ${r.zone}`, color_theme: 'sky', icon_name: 'MapPin', sort_order: 10 }, { onConflict: 'name' })
        .select()
        .single();
      if (newZ) zoneByName.set(newZ.name, newZ);
    }
    const zObj = zoneByName.get(r.zone);
    if (zObj && r.zone_id !== zObj.id) {
      await supabase.from('rooms').update({ zone_id: zObj.id }).eq('id', r.id);
    }
  }
  console.log(`✅ Synced ${zoneByName.size} zones and linked ${rooms?.length || 0} rooms.`);

  // 3. Backfill bill_audit_logs for existing invoices if not logged yet
  const [{ data: invoices }, { data: existingLogs }, { data: meterNotes }] = await Promise.all([
    supabase.from('invoices').select('*'),
    supabase.from('bill_audit_logs').select('invoice_id'),
    supabase.from('monthly_meter_notes').select('id, room_number, billing_month, billing_year_be, zone')
  ]);

  const loggedInvIds = new Set((existingLogs || []).map((l) => l.invoice_id).filter(Boolean));
  const roomZoneMap = new Map((rooms || []).map((r) => [r.room_number, r.zone]));
  const noteMap = new Map((meterNotes || []).map((n) => [`${n.room_number}|${n.billing_month}|${n.billing_year_be}`, n]));

  let backfilled = 0;
  for (const inv of invoices || []) {
    if (loggedInvIds.has(inv.id)) continue;
    const note = noteMap.get(`${inv.room_number}|${inv.billing_month}|${inv.billing_year_be}`);
    const res = await runBillAuditSubAgent(
      supabase,
      { ...inv, zone: roomZoneMap.get(inv.room_number) || note?.zone || '' },
      {
        invoice_id: inv.id,
        meter_note_id: note?.id || null,
        action_status: 'backfilled',
        notes: 'ซิงค์สมการบิลเริ่มต้นเข้าสู่ระบบ BillAuditSubAgent'
      }
    );
    if (res.success) backfilled++;
  }
  console.log(`✅ Backfilled ${backfilled} bill audit logs.`);
}

run().catch((err) => {
  console.error('❌ Migration/Seed error:', err);
  process.exit(1);
});
