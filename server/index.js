import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { toThaiBahtText } from './bahtText.js';
import { buildBillFormulaDetails, runBillAuditSubAgent } from './billAuditAgent.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

function getMonthNumber(monthName) {
  const idx = THAI_MONTHS.indexOf((monthName || '').trim());
  return idx >= 0 ? idx + 1 : 11;
}

// Helper to record history log
async function recordLog({
  action_type,
  room_id = null,
  room_number = null,
  tenant_id = null,
  tenant_name = null,
  invoice_id = null,
  description,
  amount = null,
  metadata = {}
}) {
  try {
    await supabase.from('history_logs').insert({
      action_type,
      room_id,
      room_number,
      tenant_id,
      tenant_name,
      invoice_id,
      description,
      amount,
      metadata
    });
  } catch (err) {
    console.error('Failed to write history_log:', err.message);
  }
}

// Helper: Ensure a zone record exists in dorm_zones and return it
async function ensureZoneRecord(zoneName) {
  const cleanName = (zoneName || '').trim();
  if (!cleanName) return null;
  const { data: existing } = await supabase
    .from('dorm_zones')
    .select('*')
    .eq('name', cleanName)
    .maybeSingle();
  if (existing) return existing;

  const { data: maxOrder } = await supabase
    .from('dorm_zones')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created } = await supabase
    .from('dorm_zones')
    .insert({
      name: cleanName,
      code: 'Z-' + (cleanName.slice(0, 4) || 'NEW'),
      description: `โซน ${cleanName}`,
      color_theme: 'sky',
      icon_name: 'Building2',
      sort_order: (maxOrder?.sort_order || 0) + 1
    })
    .select()
    .single();
  return created || null;
}

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'dorm-billing-system', dorm_name: 'หอพักอิ่มสุข' });
});

// 1B. Dormitory Zones Endpoints (การแบ่งโซนบริเวณหอพัก)
app.get('/api/zones', async (req, res) => {
  const [{ data: zones, error }, { data: rooms }] = await Promise.all([
    supabase.from('dorm_zones').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('rooms').select('id, room_number, zone, zone_id, status')
  ]);
  if (error) return res.status(500).json({ error: error.message });

  const enriched = (zones || []).map((z) => {
    const zRooms = (rooms || []).filter((r) => r.zone_id === z.id || r.zone === z.name);
    return {
      ...z,
      room_count: zRooms.length,
      occupied_count: zRooms.filter((r) => r.status === 'occupied').length,
      available_count: zRooms.filter((r) => r.status !== 'occupied').length
    };
  });
  res.json(enriched);
});

app.post('/api/zones', async (req, res) => {
  const b = req.body;
  const cleanName = (b.name || '').trim();
  if (!cleanName) return res.status(400).json({ error: 'กรุณาระบุชื่อโซน' });

  const { data: maxOrder } = await supabase
    .from('dorm_zones')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('dorm_zones')
    .insert({
      name: cleanName,
      code: (b.code || '').trim(),
      description: b.description || '',
      color_theme: b.color_theme || 'emerald',
      icon_name: b.icon_name || 'Building2',
      sort_order: Number(b.sort_order ?? ((maxOrder?.sort_order || 0) + 1)),
      is_active: b.is_active !== false
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await recordLog({
    action_type: 'ZONE_CREATED',
    description: `เพิ่มโซนหอพักใหม่ "${data.name}"`,
    metadata: data
  });

  res.json({ ...data, room_count: 0, occupied_count: 0, available_count: 0 });
});

app.put('/api/zones/:id', async (req, res) => {
  const { id } = req.params;
  const b = req.body;
  const { data: oldZone, error: oldErr } = await supabase.from('dorm_zones').select('*').eq('id', id).maybeSingle();
  if (oldErr || !oldZone) return res.status(404).json({ error: 'ไม่พบข้อมูลโซน' });

  const newName = (b.name || oldZone.name).trim();
  const { data: updated, error } = await supabase
    .from('dorm_zones')
    .update({
      name: newName,
      code: b.code ?? oldZone.code,
      description: b.description ?? oldZone.description,
      color_theme: b.color_theme ?? oldZone.color_theme,
      icon_name: b.icon_name ?? oldZone.icon_name,
      sort_order: Number(b.sort_order ?? oldZone.sort_order),
      is_active: b.is_active ?? oldZone.is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  if (oldZone.name !== newName) {
    await supabase.from('rooms').update({ zone: newName, zone_id: id }).or(`zone_id.eq.${id},zone.eq.${oldZone.name}`);
    await supabase.from('monthly_meter_notes').update({ zone: newName }).eq('zone', oldZone.name);
    await supabase.from('bill_audit_logs').update({ zone: newName }).eq('zone', oldZone.name);
  }

  await recordLog({
    action_type: 'ZONE_UPDATED',
    description: `แก้ไขข้อมูลโซน "${oldZone.name}" → "${newName}"`,
    metadata: { old_name: oldZone.name, new_name: newName }
  });

  res.json(updated);
});

app.delete('/api/zones/:id', async (req, res) => {
  const { id } = req.params;
  const { data: oldZone } = await supabase.from('dorm_zones').select('*').eq('id', id).maybeSingle();
  if (!oldZone) return res.status(404).json({ error: 'ไม่พบข้อมูลโซน' });

  const { data: roomsInZone } = await supabase.from('rooms').select('id').or(`zone_id.eq.${id},zone.eq.${oldZone.name}`);
  if ((roomsInZone || []).length > 0 && !req.query.reassign_to) {
    return res.status(400).json({ error: `ไม่สามารถลบโซน "${oldZone.name}" ได้ เนื่องจากยังมีห้องพัก ${roomsInZone.length} ห้องอยู่ในโซนนี้ กรุณาย้ายห้องไปโซนอื่นก่อน` });
  }

  if (req.query.reassign_to) {
    const targetZ = await ensureZoneRecord(String(req.query.reassign_to));
    if (targetZ) {
      await supabase.from('rooms').update({ zone: targetZ.name, zone_id: targetZ.id }).or(`zone_id.eq.${id},zone.eq.${oldZone.name}`);
    }
  }

  const { error } = await supabase.from('dorm_zones').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  await recordLog({
    action_type: 'ZONE_DELETED',
    description: `ลบโซนหอพัก "${oldZone.name}"`
  });

  res.json({ success: true });
});

// 1C. Sub-Agent Per-Bill Audit Logs Endpoint
app.get('/api/bill-audit-logs', async (req, res) => {
  const { billing_month, billing_year_be, room_number, tenant_name, action_status, limit = 300 } = req.query;
  let query = supabase.from('bill_audit_logs').select('*');

  if (billing_month) query = query.eq('billing_month', billing_month);
  if (billing_year_be) query = query.eq('billing_year_be', Number(billing_year_be));
  if (room_number) query = query.eq('room_number', room_number);
  if (tenant_name) query = query.ilike('tenant_name', `%${tenant_name}%`);
  if (action_status) query = query.eq('action_status', action_status);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(Number(limit));
  if (error) return res.status(500).json({ error: error.message });

  const rows = data || [];
  res.json({
    items: rows,
    stats: {
      total_records: rows.length,
      sum_computed_total: rows.reduce((s, r) => s + Number(r.computed_total || 0), 0),
      sum_room_rate: rows.reduce((s, r) => s + Number(r.room_rate || 0), 0),
      sum_water_total: rows.reduce((s, r) => s + Number(r.water_total || 0), 0),
      sum_electric_total: rows.reduce((s, r) => s + Number(r.electric_total || 0), 0),
      sum_other_signed: rows.reduce((s, r) => s + Number(r.other_amount_signed || 0), 0)
    }
  });
});

// 2. Payment Settings
app.get('/api/settings', async (req, res) => {
  const { data, error } = await supabase
    .from('payment_settings')
    .select('*')
    .limit(1)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/settings', async (req, res) => {
  const payload = req.body;
  const { data: existing } = await supabase.from('payment_settings').select('id').limit(1).single();
  let result;
  if (existing?.id) {
    result = await supabase
      .from('payment_settings')
      .update({
        dorm_name: payload.dorm_name,
        receipt_title: payload.receipt_title,
        bank_name: payload.bank_name,
        account_number: payload.account_number,
        account_holder: payload.account_holder,
        qr_code_url: payload.qr_code_url,
        qr_caption: payload.qr_caption,
        default_water_rate: Number(payload.default_water_rate ?? 10),
        default_water_per_person: Number(payload.default_water_per_person ?? 100),
        default_electric_rate: Number(payload.default_electric_rate ?? 8),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await supabase.from('payment_settings').insert(payload).select().single();
  }
  if (result.error) return res.status(500).json({ error: result.error.message });

  await recordLog({
    action_type: 'SETTINGS_UPDATED',
    description: `แก้ไขข้อมูลการโอนเงิน / QR Code (${payload.bank_name} ${payload.account_number} - ${payload.account_holder})`,
    metadata: {
      bank_name: payload.bank_name,
      account_number: payload.account_number,
      account_holder: payload.account_holder
    }
  });

  res.json(result.data);
});

// 3. Rooms & Active Tenants
app.get('/api/rooms', async (req, res) => {
  const { data: rooms, error: roomErr } = await supabase
    .from('rooms')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('room_number', { ascending: true });
  if (roomErr) return res.status(500).json({ error: roomErr.message });

  const { data: tenants, error: tenErr } = await supabase
    .from('tenants')
    .select('*')
    .eq('is_active', true);
  if (tenErr) return res.status(500).json({ error: tenErr.message });

  const tenantByRoom = {};
  for (const t of tenants || []) {
    if (t.room_id) tenantByRoom[t.room_id] = t;
    tenantByRoom[t.room_number] = t;
  }

  const enriched = rooms.map((r) => ({
    ...r,
    active_tenant: tenantByRoom[r.id] || tenantByRoom[r.room_number] || null
  }));
  res.json(enriched);
});

app.post('/api/rooms', async (req, res) => {
  const b = req.body;
  const { data: maxOrder } = await supabase
    .from('rooms')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrder?.sort_order || 0) + 1;
  const zoneObj = await ensureZoneRecord(b.zone || 'ชั้น 1');

  const { data: room, error } = await supabase
    .from('rooms')
    .insert({
      room_number: b.room_number,
      zone: zoneObj?.name || b.zone || 'ชั้น 1',
      zone_id: zoneObj?.id || b.zone_id || null,
      sort_order: b.sort_order ?? nextOrder,
      rental_type: b.rental_type || 'monthly',
      monthly_rate: Number(b.monthly_rate ?? 2500),
      daily_rate: Number(b.daily_rate ?? 350),
      water_calc_type: b.water_calc_type || 'meter',
      water_rate: Number(b.water_rate ?? 10),
      water_flat_amount: Number(b.water_flat_amount ?? 100),
      electric_rate: Number(b.electric_rate ?? 8),
      latest_water_meter: String(b.latest_water_meter ?? ''),
      latest_electric_meter: String(b.latest_electric_meter ?? ''),
      status: b.tenant_name ? 'occupied' : (b.status || 'available'),
      notes: b.notes || ''
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  let tenant = null;
  if (b.tenant_name) {
    const { data: tData } = await supabase
      .from('tenants')
      .insert({
        room_id: room.id,
        room_number: room.room_number,
        name: b.tenant_name,
        phone: b.tenant_phone || '',
        rental_type: b.rental_type === 'daily' ? 'daily' : 'monthly',
        occupant_count: Number(b.occupant_count ?? 1),
        deposit_amount: Number(b.deposit_amount ?? 2500),
        is_active: true
      })
      .select()
      .single();
    tenant = tData;
  }

  await recordLog({
    action_type: 'ROOM_CREATED',
    room_id: room.id,
    room_number: room.room_number,
    tenant_id: tenant?.id || null,
    tenant_name: tenant?.name || b.tenant_name || null,
    description: `เพิ่มห้องพักหมายเลข ${room.room_number}${tenant ? ` (ผู้เช่า: ${tenant.name})` : ''}`,
    metadata: { room, tenant }
  });

  res.json({ ...room, active_tenant: tenant });
});

app.put('/api/rooms/:id', async (req, res) => {
  const { id } = req.params;
  const b = req.body;
  const zoneObj = b.zone ? await ensureZoneRecord(b.zone) : null;

  const { data: room, error } = await supabase
    .from('rooms')
    .update({
      room_number: b.room_number,
      zone: zoneObj?.name || b.zone,
      zone_id: zoneObj?.id || b.zone_id || undefined,
      rental_type: b.rental_type,
      monthly_rate: Number(b.monthly_rate ?? 2500),
      daily_rate: Number(b.daily_rate ?? 350),
      water_calc_type: b.water_calc_type,
      water_rate: Number(b.water_rate ?? 10),
      water_flat_amount: Number(b.water_flat_amount ?? 100),
      electric_rate: Number(b.electric_rate ?? 8),
      latest_water_meter: String(b.latest_water_meter ?? ''),
      latest_electric_meter: String(b.latest_electric_meter ?? ''),
      status: b.status || (b.tenant_name ? 'occupied' : 'available'),
      notes: b.notes || '',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Update or create active tenant
  if (b.tenant_name !== undefined) {
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('room_id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (b.tenant_name.trim() === '') {
      if (existingTenant) {
        await supabase
          .from('tenants')
          .update({ is_active: false, check_out_date: new Date().toISOString().slice(0, 10) })
          .eq('id', existingTenant.id);
      }
    } else if (existingTenant) {
      // If name changed, check if it's a new tenant or rename
      await supabase
        .from('tenants')
        .update({
          room_number: room.room_number,
          name: b.tenant_name.trim(),
          phone: b.tenant_phone ?? existingTenant.phone,
          rental_type: b.tenant_rental_type || existingTenant.rental_type,
          occupant_count: Number(b.occupant_count ?? existingTenant.occupant_count ?? 1),
          deposit_amount: Number(b.deposit_amount ?? existingTenant.deposit_amount ?? 2500),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTenant.id);
    } else {
      await supabase.from('tenants').insert({
        room_id: room.id,
        room_number: room.room_number,
        name: b.tenant_name.trim(),
        phone: b.tenant_phone || '',
        rental_type: b.rental_type === 'daily' ? 'daily' : 'monthly',
        occupant_count: Number(b.occupant_count ?? 1),
        deposit_amount: Number(b.deposit_amount ?? 2500),
        is_active: true
      });
    }
  }

  await recordLog({
    action_type: 'ROOM_UPDATED',
    room_id: room.id,
    room_number: room.room_number,
    tenant_name: b.tenant_name || null,
    description: `อัปเดตข้อมูลห้อง ${room.room_number} (ผู้เช่า: ${b.tenant_name || 'ว่าง'}, ค่าเช่า: ${room.monthly_rate} บ.)`,
    metadata: b
  });

  res.json(room);
});

// Quick Room Status Toggle (occupied | vacant | maintenance) - preserves all rental history
app.patch('/api/rooms/:id/status', async (req, res) => {
  const { id } = req.params;
  const rawStatus = String(req.body.status || 'vacant').toLowerCase();
  const normalizedStatus = rawStatus === 'available' ? 'vacant' : rawStatus;
  if (!['occupied', 'vacant', 'maintenance'].includes(normalizedStatus)) {
    return res.status(400).json({ error: 'สถานะห้องต้องเป็น occupied, vacant หรือ maintenance' });
  }

  const { data: existingRoom, error: fetchErr } = await supabase.from('rooms').select('*').eq('id', id).maybeSingle();
  if (fetchErr || !existingRoom) return res.status(404).json({ error: 'ไม่พบห้องพักนี้' });

  const { data: updatedRoom, error: updErr } = await supabase
    .from('rooms')
    .update({ status: normalizedStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (updErr) return res.status(500).json({ error: updErr.message });

  const { data: activeTenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('room_id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (normalizedStatus === 'vacant' && req.body.check_out_active_tenant && activeTenant) {
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from('tenants')
      .update({ is_active: false, check_out_date: today, updated_at: new Date().toISOString() })
      .eq('id', activeTenant.id);

    await supabase.from('tenant_stays').insert({
      tenant_id: activeTenant.id,
      tenant_name: activeTenant.name,
      room_id: existingRoom.id,
      room_number: existingRoom.room_number,
      event_type: 'move_out',
      rental_type: activeTenant.rental_type || 'monthly',
      rate_amount: existingRoom.monthly_rate,
      deposit_amount: activeTenant.deposit_amount,
      start_date: today,
      end_date: today,
      status: 'completed',
      notes: req.body.note || `กำหนดห้อง ${existingRoom.room_number} เป็นห้องว่าง (ย้ายออก)`
    });
  }

  const statusThai = normalizedStatus === 'vacant' ? 'ห้องว่าง' : normalizedStatus === 'maintenance' ? 'ซ่อมบำรุง' : 'มีผู้เช่า';
  await recordLog({
    action_type: 'ROOM_STATUS_CHANGE',
    room_id: existingRoom.id,
    room_number: existingRoom.room_number,
    tenant_id: activeTenant?.id || null,
    tenant_name: activeTenant?.name || '',
    description: `เปลี่ยนสถานะห้อง ${existingRoom.room_number} เป็น "${statusThai}"${req.body.note ? ` (${req.body.note})` : ''}`,
    metadata: { previous_status: existingRoom.status, new_status: normalizedStatus }
  });

  res.json(updatedRoom);
});

app.delete('/api/rooms/:id', async (req, res) => {
  const { id } = req.params;
  const { data: room } = await supabase.from('rooms').select('*').eq('id', id).maybeSingle();
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  if (room) {
    await recordLog({
      action_type: 'ROOM_DELETED',
      room_number: room.room_number,
      description: `ลบข้อมูลห้องพักหมายเลข ${room.room_number}`
    });
  }
  res.json({ success: true });
});

// 4. Tenants & Tenant Stay History Endpoints
// Dedicated Tenant-Centric Full-Name Search & History Aggregation
app.get('/api/tenants/search-history', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);

  const [
    { data: allTenants, error: tErr },
    { data: allStays },
    { data: allLogs },
    { data: allInvoices },
    { data: allAuditLogs }
  ] = await Promise.all([
    supabase.from('tenants').select('*').order('is_active', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('tenant_stays').select('*').order('start_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('history_logs').select('*').order('created_at', { ascending: false }).limit(1000),
    supabase.from('invoices').select('id, invoice_number, tenant_id, tenant_name, room_number, billing_month, billing_year_be, room_rate, water_total, electric_total, other_description, other_amount, total_amount, created_at').order('created_at', { ascending: false }),
    supabase.from('bill_audit_logs').select('*').order('created_at', { ascending: false }).limit(500)
  ]);

  if (tErr) return res.status(500).json({ error: tErr.message });

  const matchesTokens = (text) => {
    if (tokens.length === 0) return true;
    const hay = String(text || '').toLowerCase();
    return tokens.every((tk) => hay.includes(tk));
  };

  const groups = new Map();
  const ensureGroup = (rawName) => {
    const clean = String(rawName || '').trim();
    if (!clean) return null;
    const key = clean.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        tenant_name: clean,
        tenant_records: [],
        stays: [],
        history_logs: [],
        invoices: [],
        audit_logs: []
      });
    }
    return groups.get(key);
  };

  const tenantById = {};
  for (const t of allTenants || []) {
    if (t.id) tenantById[t.id] = t;
    if (matchesTokens(t.name)) {
      const g = ensureGroup(t.name);
      if (g) g.tenant_records.push(t);
    }
  }

  for (const st of allStays || []) {
    const resolvedName = st.tenant_name || (st.tenant_id ? tenantById[st.tenant_id]?.name : '');
    if (resolvedName && matchesTokens(resolvedName)) {
      const g = ensureGroup(resolvedName);
      if (g) g.stays.push(st);
    }
  }

  for (const lg of allLogs || []) {
    const resolvedName = lg.tenant_name || (lg.tenant_id ? tenantById[lg.tenant_id]?.name : '');
    if (resolvedName && matchesTokens(resolvedName)) {
      const g = ensureGroup(resolvedName);
      if (g) g.history_logs.push(lg);
    }
  }

  for (const inv of allInvoices || []) {
    const resolvedName = inv.tenant_name || (inv.tenant_id ? tenantById[inv.tenant_id]?.name : '');
    if (resolvedName && matchesTokens(resolvedName)) {
      const g = ensureGroup(resolvedName);
      if (g) g.invoices.push(inv);
    }
  }

  for (const al of allAuditLogs || []) {
    if (al.tenant_name && matchesTokens(al.tenant_name)) {
      const g = ensureGroup(al.tenant_name);
      if (g) g.audit_logs.push(al);
    }
  }

  const results = [...groups.values()]
    .filter((g) => matchesTokens(g.tenant_name))
    .map((g) => {
      const primary = g.tenant_records.find((r) => r.is_active) || g.tenant_records[0] || null;
      const roomsSet = new Set([
        ...g.tenant_records.map((r) => r.room_number).filter(Boolean),
        ...g.stays.map((s) => s.room_number).filter(Boolean),
        ...g.stays.map((s) => s.previous_room_number).filter(Boolean),
        ...g.invoices.map((i) => i.room_number).filter(Boolean)
      ]);
      const transferCount = g.stays.filter((s) => s.event_type === 'room_transfer').length +
        g.history_logs.filter((l) => l.action_type === 'ROOM_TRANSFER').length;
      const totalPaid = g.invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      return {
        tenant_name: g.tenant_name,
        primary_tenant: primary,
        tenant_records: g.tenant_records,
        stays: g.stays,
        history_logs: g.history_logs,
        invoices: g.invoices,
        audit_logs: g.audit_logs,
        summary: {
          is_active: Boolean(g.tenant_records.some((r) => r.is_active)),
          current_room: primary?.room_number || '',
          rooms_stayed: [...roomsSet],
          transfer_count: transferCount,
          invoice_count: g.invoices.length,
          total_paid: totalPaid
        }
      };
    })
    .sort((a, b) => {
      if (a.summary.is_active !== b.summary.is_active) return a.summary.is_active ? -1 : 1;
      return a.tenant_name.localeCompare(b.tenant_name, 'th');
    });

  res.json({ query: q, total: results.length, results });
});

app.get('/api/tenants', async (req, res) => {
  const [{ data: tenants, error }, { data: stays }, { data: invoices }] = await Promise.all([
    supabase.from('tenants').select('*').order('is_active', { ascending: false }).order('room_number', { ascending: true }),
    supabase.from('tenant_stays').select('*').order('start_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('invoices').select('id, invoice_number, tenant_id, tenant_name, room_number, billing_month, billing_year_be, total_amount, water_total, electric_total, room_rate, other_description, created_at').order('created_at', { ascending: false })
  ]);
  if (error) return res.status(500).json({ error: error.message });

  const staysByTenantId = {};
  const staysByName = {};
  for (const s of stays || []) {
    if (s.tenant_id) {
      if (!staysByTenantId[s.tenant_id]) staysByTenantId[s.tenant_id] = [];
      staysByTenantId[s.tenant_id].push(s);
    }
    if (s.tenant_name) {
      if (!staysByName[s.tenant_name]) staysByName[s.tenant_name] = [];
      staysByName[s.tenant_name].push(s);
    }
  }

  const invByTenantId = {};
  const invByName = {};
  for (const inv of invoices || []) {
    if (inv.tenant_id) {
      if (!invByTenantId[inv.tenant_id]) invByTenantId[inv.tenant_id] = [];
      invByTenantId[inv.tenant_id].push(inv);
    }
    if (inv.tenant_name) {
      if (!invByName[inv.tenant_name]) invByName[inv.tenant_name] = [];
      invByName[inv.tenant_name].push(inv);
    }
  }

  const enriched = (tenants || []).map((t) => {
    const tStays = staysByTenantId[t.id] || staysByName[t.name] || [];
    const tInvs = invByTenantId[t.id] || invByName[t.name] || [];
    const totalPaid = tInvs.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    return {
      ...t,
      stays: tStays,
      invoices: tInvs,
      total_paid: totalPaid
    };
  });

  res.json(enriched);
});

app.post('/api/tenants', async (req, res) => {
  const b = req.body;
  if (b.room_id && b.is_active !== false) {
    await supabase
      .from('tenants')
      .update({ is_active: false, check_out_date: new Date().toISOString().slice(0, 10) })
      .eq('room_id', b.room_id)
      .eq('is_active', true);
    await supabase.from('rooms').update({ status: 'occupied' }).eq('id', b.room_id);
  }

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      room_id: b.room_id || null,
      room_number: b.room_number || '',
      name: b.name,
      phone: b.phone || '',
      id_card: b.id_card || '',
      id_card_image_url: b.id_card_image_url || null,
      house_reg_image_url: b.house_reg_image_url || null,
      home_address: b.home_address || '',
      emergency_contact: b.emergency_contact || '',
      rental_type: b.rental_type || 'monthly',
      occupant_count: Number(b.occupant_count ?? 1),
      deposit_amount: Number(b.deposit_amount ?? 2500),
      check_in_date: b.check_in_date || new Date().toISOString().slice(0, 10),
      is_active: b.is_active !== false,
      notes: b.notes || ''
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Also record initial stay in tenant_stays
  await supabase.from('tenant_stays').insert({
    tenant_id: data.id,
    tenant_name: data.name,
    room_id: data.room_id,
    room_number: data.room_number,
    event_type: 'check_in',
    rental_type: data.rental_type,
    rate_amount: Number(b.rate_amount ?? 2500),
    deposit_amount: data.deposit_amount,
    start_date: data.check_in_date || new Date().toISOString().slice(0, 10),
    status: 'active',
    notes: b.notes || 'ลงทะเบียนเข้าพักใหม่'
  });

  await recordLog({
    action_type: 'TENANT_CHECK_IN',
    room_id: data.room_id,
    room_number: data.room_number,
    tenant_id: data.id,
    tenant_name: data.name,
    description: `ลงทะเบียนผู้เช่าใหม่ "${data.name}" ห้อง ${data.room_number} (${data.rental_type === 'daily' ? 'รายวัน' : 'รายเดือน'}, จำนวน ${data.occupant_count} คน)`,
    amount: data.deposit_amount,
    metadata: { id: data.id, room_number: data.room_number, name: data.name }
  });

  res.json(data);
});

app.put('/api/tenants/:id', async (req, res) => {
  const { id } = req.params;
  const b = req.body;
  const { data, error } = await supabase
    .from('tenants')
    .update({
      room_id: b.room_id,
      room_number: b.room_number,
      name: b.name,
      phone: b.phone,
      id_card: b.id_card,
      id_card_image_url: b.id_card_image_url ?? null,
      house_reg_image_url: b.house_reg_image_url ?? null,
      home_address: b.home_address ?? '',
      emergency_contact: b.emergency_contact ?? '',
      rental_type: b.rental_type,
      occupant_count: Number(b.occupant_count ?? 1),
      deposit_amount: Number(b.deposit_amount ?? 2500),
      check_in_date: b.check_in_date,
      check_out_date: b.check_out_date || null,
      is_active: b.is_active,
      notes: b.notes,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  await recordLog({
    action_type: b.is_active === false ? 'TENANT_MOVE_OUT' : 'TENANT_UPDATED',
    room_id: data.room_id,
    room_number: data.room_number,
    tenant_id: data.id,
    tenant_name: data.name,
    description: b.is_active === false
      ? `ผู้เช่า "${data.name}" ย้ายออกจากห้อง ${data.room_number}`
      : `อัปเดตประวัติ/เอกสารผู้เช่า "${data.name}" ห้อง ${data.room_number}`,
    metadata: { id: data.id, room_number: data.room_number, has_id_card_img: Boolean(data.id_card_image_url), has_house_reg_img: Boolean(data.house_reg_image_url) }
  });

  res.json(data);
});

// Room Transfer / Stay Event Endpoint (ย้ายห้อง / เข้าพักใหม่ / แจ้งย้ายออก พร้อมบันทึกประวัติย้อนหลัง)
app.post('/api/tenants/:id/transfer', async (req, res) => {
  const { id } = req.params;
  const b = req.body; // { event_type: 'room_transfer' | 'move_out' | 'check_in', new_room_number, event_date, rate_amount, deposit_amount, notes }
  const { data: tenant, error: tErr } = await supabase.from('tenants').select('*').eq('id', id).single();
  if (tErr || !tenant) return res.status(404).json({ error: 'ไม่พบข้อมูลผู้เช่า' });

  const eventDate = b.event_date || new Date().toISOString().slice(0, 10);
  const oldRoomNumber = tenant.room_number;

  // Close current active stay
  await supabase
    .from('tenant_stays')
    .update({
      end_date: eventDate,
      status: b.event_type === 'room_transfer' ? 'transferred' : 'moved_out'
    })
    .eq('tenant_id', id)
    .eq('status', 'active');

  if (b.event_type === 'move_out') {
    await supabase
      .from('tenants')
      .update({ is_active: false, check_out_date: eventDate, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (tenant.room_id) {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', tenant.room_id);
    }

    await supabase.from('tenant_stays').insert({
      tenant_id: id,
      tenant_name: tenant.name,
      room_id: tenant.room_id,
      room_number: oldRoomNumber,
      event_type: 'move_out',
      rental_type: tenant.rental_type,
      rate_amount: Number(b.rate_amount || 2500),
      deposit_amount: Number(b.deposit_amount ?? tenant.deposit_amount ?? 2500),
      start_date: tenant.check_in_date || eventDate,
      end_date: eventDate,
      status: 'moved_out',
      notes: b.notes || `แจ้งย้ายออกจากห้อง ${oldRoomNumber}`
    });

    await recordLog({
      action_type: 'TENANT_MOVE_OUT',
      room_id: tenant.room_id,
      room_number: oldRoomNumber,
      tenant_id: id,
      tenant_name: tenant.name,
      description: `ผู้เช่า "${tenant.name}" แจ้งย้ายออกจากห้อง ${oldRoomNumber} (${b.notes || '-'})`
    });
  } else {
    // Room Transfer or Re-Check-in
    const targetRoomNo = b.new_room_number || oldRoomNumber;
    const { data: newRoom } = await supabase.from('rooms').select('*').eq('room_number', targetRoomNo).maybeSingle();

    if (tenant.room_id && newRoom && tenant.room_id !== newRoom.id) {
      await supabase.from('rooms').update({ status: 'available' }).eq('id', tenant.room_id);
      await supabase.from('rooms').update({ status: 'occupied' }).eq('id', newRoom.id);
    }

    await supabase
      .from('tenants')
      .update({
        room_id: newRoom?.id || tenant.room_id,
        room_number: targetRoomNo,
        is_active: true,
        check_out_date: null,
        deposit_amount: Number(b.deposit_amount ?? tenant.deposit_amount ?? 2500),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    await supabase.from('tenant_stays').insert({
      tenant_id: id,
      tenant_name: tenant.name,
      room_id: newRoom?.id || null,
      room_number: targetRoomNo,
      previous_room_number: b.event_type === 'room_transfer' ? oldRoomNumber : null,
      event_type: b.event_type || 'room_transfer',
      rental_type: b.rental_type || tenant.rental_type || 'monthly',
      rate_amount: Number(b.rate_amount || newRoom?.monthly_rate || 2500),
      deposit_amount: Number(b.deposit_amount ?? tenant.deposit_amount ?? 2500),
      start_date: eventDate,
      status: 'active',
      notes: b.notes || (b.event_type === 'room_transfer' ? `ย้ายจากห้อง ${oldRoomNumber} มาห้อง ${targetRoomNo}` : `เข้าพักห้อง ${targetRoomNo}`)
    });

    await recordLog({
      action_type: 'ROOM_TRANSFER',
      room_id: newRoom?.id || null,
      room_number: targetRoomNo,
      tenant_id: id,
      tenant_name: tenant.name,
      description: `ผู้เช่า "${tenant.name}" ย้ายห้องจาก ${oldRoomNumber} → ห้อง ${targetRoomNo} (${b.notes || 'บันทึกประวัติการย้ายห้อง'})`,
      metadata: { previous_room: oldRoomNumber, new_room: targetRoomNo, event_date: eventDate }
    });
  }

  res.json({ success: true });
});

// 5. Invoices / Billing Endpoints
app.get('/api/invoices', async (req, res) => {
  const { billing_month, billing_year_be, invoice_type, room_number, tenant_name } = req.query;
  let query = supabase.from('invoices').select('*');

  if (billing_month) query = query.eq('billing_month', billing_month);
  if (billing_year_be) query = query.eq('billing_year_be', Number(billing_year_be));
  if (invoice_type) query = query.eq('invoice_type', invoice_type);
  if (room_number) query = query.eq('room_number', room_number);
  if (tenant_name) query = query.ilike('tenant_name', `%${tenant_name}%`);

  const { data: invoices, error } = await query.order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  // Sort by rooms.sort_order if available
  const { data: rooms } = await supabase.from('rooms').select('room_number, sort_order');
  const orderMap = {};
  for (const r of rooms || []) orderMap[r.room_number] = r.sort_order;

  invoices.sort((a, b) => {
    const oa = orderMap[a.room_number] ?? 999;
    const ob = orderMap[b.room_number] ?? 999;
    if (oa !== ob) return oa - ob;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  res.json(invoices);
});

// Save or Upsert Single / Batch Invoices (Monthly or Daily)
app.post('/api/invoices', async (req, res) => {
  const b = req.body;
  const { data: settings } = await supabase.from('payment_settings').select('*').limit(1).maybeSingle();

  const totalAmount = Number(b.total_amount ?? 0);
  const bahtText = b.baht_text || toThaiBahtText(totalAmount);
  const monthNum = b.billing_month_num || getMonthNumber(b.billing_month);
  const invNumber = b.invoice_number || `INV-${b.billing_year_be || 2569}${String(monthNum).padStart(2, '0')}-${b.room_number}-${Date.now().toString().slice(-4)}`;

  const payload = {
    invoice_number: invNumber,
    room_id: b.room_id || null,
    tenant_id: b.tenant_id || null,
    room_number: String(b.room_number || ''),
    tenant_name: String(b.tenant_name || ''),
    invoice_type: b.invoice_type || 'monthly',
    doc_day: String(b.doc_day ?? '1'),
    billing_month: String(b.billing_month ?? 'พฤศจิกายน'),
    billing_month_num: monthNum,
    billing_year_be: Number(b.billing_year_be ?? 2569),
    room_rate: Number(b.room_rate ?? 0),
    room_rate_label: b.room_rate_label || `ค่าห้องเดือน...${b.billing_month || ''}`,
    days_count: Number(b.days_count ?? 1),
    water_calc_type: b.water_calc_type || 'meter',
    water_prev: String(b.water_prev ?? ''),
    water_curr: String(b.water_curr ?? ''),
    water_units: Number(b.water_units ?? 0),
    water_unit_price: b.water_unit_price !== null && b.water_unit_price !== '' && b.water_unit_price !== undefined ? Number(b.water_unit_price) : null,
    occupant_count: Number(b.occupant_count ?? 1),
    water_total: Number(b.water_total ?? 0),
    electric_prev: String(b.electric_prev ?? ''),
    electric_curr: String(b.electric_curr ?? ''),
    electric_units: Number(b.electric_units ?? 0),
    electric_unit_price: Number(b.electric_unit_price ?? 8),
    electric_total: Number(b.electric_total ?? 0),
    other_description: String(b.other_description ?? ''),
    other_amount: Number(b.other_amount ?? 0),
    deposit_deduction: Number(b.deposit_deduction ?? 0),
    is_move_out: Boolean(b.is_move_out),
    custom_lines: Array.isArray(b.custom_lines) ? b.custom_lines : [],
    total_amount: totalAmount,
    baht_text: bahtText,
    status: b.status || 'paid',
    bank_name_snapshot: b.bank_name_snapshot || settings?.bank_name || 'ธ.ก.ส.',
    account_number_snapshot: b.account_number_snapshot || settings?.account_number || '017562024411',
    account_holder_snapshot: b.account_holder_snapshot || settings?.account_holder || 'นาง เอมอร ไทยนอ',
    qr_caption_snapshot: b.qr_caption_snapshot || settings?.qr_caption || 'นาง เอมอร ไทยนอ',
    notes: b.notes || '',
    updated_at: new Date().toISOString()
  };

  let result;
  if (b.id) {
    result = await supabase.from('invoices').update(payload).eq('id', b.id).select().single();
  } else {
    result = await supabase.from('invoices').insert(payload).select().single();
  }
  if (result.error) return res.status(500).json({ error: result.error.message });
  const inv = result.data;

  // Update room's latest meter readings if present
  if (inv.room_id && b.update_room_meter !== false) {
    const roomUpdates = { updated_at: new Date().toISOString() };
    if (inv.water_curr !== '') roomUpdates.latest_water_meter = inv.water_curr;
    if (inv.electric_curr !== '') roomUpdates.latest_electric_meter = inv.electric_curr;
    await supabase.from('rooms').update(roomUpdates).eq('id', inv.room_id);
  }

  const typeLabel = inv.invoice_type === 'daily' ? 'รายวัน/กำหนดเอง' : 'รายเดือน';
  await recordLog({
    action_type: inv.is_move_out ? 'MOVE_OUT_DEDUCTION' : (b.id ? 'INVOICE_UPDATED' : 'INVOICE_CREATED'),
    room_id: inv.room_id,
    room_number: inv.room_number,
    tenant_id: inv.tenant_id,
    tenant_name: inv.tenant_name,
    invoice_id: inv.id,
    description: `${b.id ? 'แก้ไข' : 'ออก'}ใบเสร็จ (${typeLabel}) ห้อง ${inv.room_number || '-'} ผู้เช่า "${inv.tenant_name || '-'}" ประจำเดือน ${inv.billing_month} ${inv.billing_year_be} ยอดสุทธิ ${Number(inv.total_amount).toLocaleString()} บาท${inv.other_description ? ` [${inv.other_description}]` : ''}`,
    amount: inv.total_amount,
    metadata: {
      invoice_number: inv.invoice_number,
      invoice_type: inv.invoice_type,
      billing_month: inv.billing_month,
      billing_year_be: inv.billing_year_be,
      water_prev: inv.water_prev,
      water_curr: inv.water_curr,
      water_total: inv.water_total,
      electric_prev: inv.electric_prev,
      electric_curr: inv.electric_curr,
      electric_total: inv.electric_total,
      room_rate: inv.room_rate,
      other_description: inv.other_description,
      other_amount: inv.other_amount,
      deposit_deduction: inv.deposit_deduction
    }
  });

  // Sub-Agent Per-Bill Formula Logger
  let roomZone = b.zone || '';
  if (!roomZone && inv.room_id) {
    const { data: rm } = await supabase.from('rooms').select('zone').eq('id', inv.room_id).maybeSingle();
    roomZone = rm?.zone || '';
  }
  await runBillAuditSubAgent(
    supabase,
    { ...inv, zone: roomZone },
    {
      invoice_id: inv.id,
      action_status: b.id ? 'updated' : 'recorded',
      notes: `บันทึกผ่านระบบออกใบเสร็จ (${typeLabel})`
    }
  );

  res.json(inv);
});

// Batch save/generate monthly invoices
app.post('/api/invoices/batch', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No invoice items provided' });
  }

  const { data: settings } = await supabase.from('payment_settings').select('*').limit(1).maybeSingle();
  const saved = [];

  for (let i = 0; i < items.length; i++) {
    const b = items[i];
    const totalAmount = Number(b.total_amount ?? 0);
    const bahtText = b.baht_text || toThaiBahtText(totalAmount);
    const monthNum = b.billing_month_num || getMonthNumber(b.billing_month);
    const invNumber = b.invoice_number || `INV-${b.billing_year_be || 2569}${String(monthNum).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}-${Date.now().toString().slice(-3)}`;

    const payload = {
      invoice_number: invNumber,
      room_id: b.room_id || null,
      tenant_id: b.tenant_id || null,
      room_number: String(b.room_number || ''),
      tenant_name: String(b.tenant_name || ''),
      invoice_type: b.invoice_type || 'monthly',
      doc_day: String(b.doc_day ?? '1'),
      billing_month: String(b.billing_month ?? 'พฤศจิกายน'),
      billing_month_num: monthNum,
      billing_year_be: Number(b.billing_year_be ?? 2569),
      room_rate: Number(b.room_rate ?? 0),
      room_rate_label: b.room_rate_label || `ค่าห้องเดือน...${b.billing_month || ''}`,
      days_count: Number(b.days_count ?? 1),
      water_calc_type: b.water_calc_type || 'meter',
      water_prev: String(b.water_prev ?? ''),
      water_curr: String(b.water_curr ?? ''),
      water_units: Number(b.water_units ?? 0),
      water_unit_price: b.water_unit_price !== null && b.water_unit_price !== '' && b.water_unit_price !== undefined ? Number(b.water_unit_price) : null,
      occupant_count: Number(b.occupant_count ?? 1),
      water_total: Number(b.water_total ?? 0),
      electric_prev: String(b.electric_prev ?? ''),
      electric_curr: String(b.electric_curr ?? ''),
      electric_units: Number(b.electric_units ?? 0),
      electric_unit_price: Number(b.electric_unit_price ?? 8),
      electric_total: Number(b.electric_total ?? 0),
      other_description: String(b.other_description ?? ''),
      other_amount: Number(b.other_amount ?? 0),
      deposit_deduction: Number(b.deposit_deduction ?? 0),
      is_move_out: Boolean(b.is_move_out),
      total_amount: totalAmount,
      baht_text: bahtText,
      status: b.status || 'paid',
      bank_name_snapshot: settings?.bank_name || 'ธ.ก.ส.',
      account_number_snapshot: settings?.account_number || '017562024411',
      account_holder_snapshot: settings?.account_holder || 'นาง เอมอร ไทยนอ',
      qr_caption_snapshot: settings?.qr_caption || 'นาง เอมอร ไทยนอ',
      updated_at: new Date().toISOString()
    };

    let result;
    if (b.id) {
      result = await supabase.from('invoices').update(payload).eq('id', b.id).select().single();
    } else {
      result = await supabase.from('invoices').insert(payload).select().single();
    }
    if (result.error) continue;
    const inv = result.data;
    saved.push(inv);

    if (inv.room_id) {
      const roomUpdates = { updated_at: new Date().toISOString() };
      if (inv.water_curr !== '') roomUpdates.latest_water_meter = inv.water_curr;
      if (inv.electric_curr !== '') roomUpdates.latest_electric_meter = inv.electric_curr;
      await supabase.from('rooms').update(roomUpdates).eq('id', inv.room_id);
    }

    await recordLog({
      action_type: inv.is_move_out ? 'MOVE_OUT_DEDUCTION' : (b.id ? 'INVOICE_UPDATED' : 'INVOICE_CREATED'),
      room_id: inv.room_id,
      room_number: inv.room_number,
      tenant_id: inv.tenant_id,
      tenant_name: inv.tenant_name,
      invoice_id: inv.id,
      description: `บันทึกบิลรายเดือน (${inv.billing_month} ${inv.billing_year_be}) ห้อง ${inv.room_number} - ${inv.tenant_name} ยอดรวม ${Number(inv.total_amount).toLocaleString()} บาท${inv.other_description ? ` [${inv.other_description}]` : ''}`,
      amount: inv.total_amount,
      metadata: {
        billing_month: inv.billing_month,
        billing_year_be: inv.billing_year_be,
        water_prev: inv.water_prev,
        water_curr: inv.water_curr,
        water_total: inv.water_total,
        electric_prev: inv.electric_prev,
        electric_curr: inv.electric_curr,
        electric_total: inv.electric_total,
        room_rate: inv.room_rate,
        other_description: inv.other_description,
        deposit_deduction: inv.deposit_deduction
      }
    });

    await runBillAuditSubAgent(
      supabase,
      { ...inv, zone: b.zone || '' },
      {
        invoice_id: inv.id,
        action_status: b.id ? 'updated' : 'recorded',
        notes: 'บันทึกบิลรายเดือนแบบชุด (Batch)'
      }
    );
  }

  res.json({ saved_count: saved.length, invoices: saved });
});

app.delete('/api/invoices/:id', async (req, res) => {
  const { id } = req.params;
  const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  if (inv) {
    await recordLog({
      action_type: 'INVOICE_DELETED',
      room_number: inv.room_number,
      tenant_name: inv.tenant_name,
      description: `ลบใบเสร็จเลขที่ ${inv.invoice_number} (ห้อง ${inv.room_number} - ${inv.tenant_name})`
    });
  }
  res.json({ success: true });
});

// 6. History Logs (แยกตามรายชื่อผู้เช่า และตามหมายเลขห้อง)
app.get('/api/logs', async (req, res) => {
  const { room_number, tenant_name, action_type, limit = 200 } = req.query;
  let query = supabase.from('history_logs').select('*');

  if (room_number) query = query.eq('room_number', room_number);
  if (tenant_name) query = query.ilike('tenant_name', `%${tenant_name}%`);
  if (action_type) query = query.eq('action_type', action_type);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(Number(limit));
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// 7. Accounting Transactions (รายรับ-รายจ่าย การซ่อมบำรุง และค่าใช้จ่ายแฝง)
app.get('/api/accounting', async (req, res) => {
  const { billing_month, billing_year_be, tx_type, cost_nature } = req.query;
  let query = supabase.from('accounting_transactions').select('*');

  if (billing_month) query = query.eq('billing_month', billing_month);
  if (billing_year_be) query = query.eq('billing_year_be', Number(billing_year_be));
  if (tx_type) query = query.eq('tx_type', tx_type);
  if (cost_nature) query = query.eq('cost_nature', cost_nature);

  const { data, error } = await query
    .order('tx_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/accounting', async (req, res) => {
  const b = req.body;
  const monthNum = b.billing_month_num || getMonthNumber(b.billing_month);
  const txCode = b.tx_code || `ACC-${b.billing_year_be || 2569}${String(monthNum).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

  const payload = {
    tx_code: txCode,
    tx_type: b.tx_type || 'expense',
    category: b.category || 'ค่าซ่อมบำรุงห้องพัก',
    cost_nature: b.cost_nature || 'direct',
    title: b.title || '',
    description: b.description || '',
    amount: Number(b.amount ?? 0),
    tx_date: b.tx_date || new Date().toISOString().slice(0, 10),
    billing_month: b.billing_month || 'พฤศจิกายน',
    billing_month_num: monthNum,
    billing_year_be: Number(b.billing_year_be ?? 2569),
    room_number: b.room_number || 'ส่วนกลาง',
    vendor_or_payee: b.vendor_or_payee || '',
    payment_method: b.payment_method || 'โอนเงิน',
    reference_doc: b.reference_doc || '',
    receipt_image_url: b.receipt_image_url || null,
    updated_at: new Date().toISOString()
  };

  let result;
  if (b.id) {
    result = await supabase.from('accounting_transactions').update(payload).eq('id', b.id).select().single();
  } else {
    result = await supabase.from('accounting_transactions').insert(payload).select().single();
  }
  if (result.error) return res.status(500).json({ error: result.error.message });
  const tx = result.data;

  await recordLog({
    action_type: tx.tx_type === 'income' ? 'ACCOUNTING_INCOME' : 'ACCOUNTING_EXPENSE',
    room_number: tx.room_number,
    description: `${b.id ? 'แก้ไข' : 'บันทึก'}บัญชี${tx.tx_type === 'income' ? 'รายรับเสริม' : 'รายจ่าย'} [${tx.category}] "${tx.title}" จำนวน ${Number(tx.amount).toLocaleString()} บาท`,
    amount: tx.amount,
    metadata: { tx_code: tx.tx_code, category: tx.category, cost_nature: tx.cost_nature }
  });

  res.json(tx);
});

app.delete('/api/accounting/:id', async (req, res) => {
  const { id } = req.params;
  const { data: tx } = await supabase.from('accounting_transactions').select('*').eq('id', id).maybeSingle();
  const { error } = await supabase.from('accounting_transactions').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });

  if (tx) {
    await recordLog({
      action_type: 'ACCOUNTING_DELETED',
      room_number: tx.room_number,
      description: `ลบรายการบัญชี ${tx.tx_code} "${tx.title}" (${Number(tx.amount).toLocaleString()} บาท)`
    });
  }
  res.json({ success: true });
});

// 8. Dashboard Summary (รายเดือน & รายปี + บัญชีรายรับ-รายจ่าย + ข้อมูลอินโฟกราฟิกผู้บริหาร)
app.get('/api/dashboard', async (req, res) => {
  const yearBe = Number(req.query.year_be || 2569);
  const monthName = req.query.month || 'พฤศจิกายน';

  const [{ data: rooms }, { data: tenants }, { data: yearInvoices }, { data: yearAccounting }] = await Promise.all([
    supabase.from('rooms').select('*').order('sort_order', { ascending: true }),
    supabase.from('tenants').select('*').eq('is_active', true),
    supabase.from('invoices').select('*').eq('billing_year_be', yearBe).neq('status', 'cancelled'),
    supabase.from('accounting_transactions').select('*').eq('billing_year_be', yearBe)
  ]);

  const monthInvoices = (yearInvoices || []).filter((inv) => inv.billing_month === monthName);
  const monthAccounting = (yearAccounting || []).filter((tx) => tx.billing_month === monthName);

  const sumFields = (list, accList = []) => {
    const base = list.reduce(
      (acc, inv) => {
        acc.total_revenue += Number(inv.total_amount || 0);
        acc.room_revenue += Number(inv.room_rate || 0);
        acc.water_revenue += Number(inv.water_total || 0);
        acc.electric_revenue += Number(inv.electric_total || 0);
        acc.water_units += Number(inv.water_units || 0);
        acc.electric_units += Number(inv.electric_units || 0);
        acc.deposit_deductions += Number(inv.deposit_deduction || 0);
        acc.invoice_count += 1;
        if (inv.invoice_type === 'daily') acc.daily_revenue += Number(inv.total_amount || 0);
        else acc.monthly_revenue += Number(inv.total_amount || 0);
        return acc;
      },
      {
        total_revenue: 0,
        room_revenue: 0,
        water_revenue: 0,
        electric_revenue: 0,
        water_units: 0,
        electric_units: 0,
        deposit_deductions: 0,
        daily_revenue: 0,
        monthly_revenue: 0,
        invoice_count: 0,
        extra_income: 0,
        total_income: 0,
        direct_expenses: 0,
        hidden_expenses: 0,
        maintenance_expenses: 0,
        utility_cost_expenses: 0,
        total_expenses: 0,
        net_profit: 0,
        profit_margin: 0
      }
    );

    for (const tx of accList) {
      const amt = Number(tx.amount || 0);
      if (tx.tx_type === 'income') {
        base.extra_income += amt;
      } else {
        base.total_expenses += amt;
        if (tx.cost_nature === 'hidden') base.hidden_expenses += amt;
        else base.direct_expenses += amt;

        if ((tx.category || '').includes('ซ่อม')) base.maintenance_expenses += amt;
        if ((tx.category || '').includes('สาธารณูปโภค')) base.utility_cost_expenses += amt;
      }
    }

    base.total_income = base.total_revenue + base.extra_income;
    base.net_profit = base.total_income - base.total_expenses;
    base.profit_margin = base.total_income > 0 ? Number(((base.net_profit / base.total_income) * 100).toFixed(1)) : 0;
    return base;
  };

  const monthlySummary = sumFields(monthInvoices, monthAccounting);
  const yearlySummary = sumFields(yearInvoices || [], yearAccounting || []);

  // Breakdown by all 12 months in yearBe
  const byMonth = THAI_MONTHS.map((m, idx) => {
    const list = (yearInvoices || []).filter((inv) => inv.billing_month === m);
    const accList = (yearAccounting || []).filter((tx) => tx.billing_month === m);
    return {
      month: m,
      month_num: idx + 1,
      ...sumFields(list, accList)
    };
  });

  // Breakdown by zone
  const zoneMap = {};
  for (const r of rooms || []) {
    if (!zoneMap[r.zone]) {
      zoneMap[r.zone] = { zone: r.zone, room_count: 0, occupied_count: 0, revenue: 0, electric_units: 0, water_revenue: 0 };
    }
    zoneMap[r.zone].room_count += 1;
    if (r.status === 'occupied') zoneMap[r.zone].occupied_count += 1;
  }
  for (const inv of monthInvoices) {
    const r = (rooms || []).find((rm) => rm.room_number === inv.room_number);
    const z = r?.zone || 'ทั่วไป';
    if (!zoneMap[z]) zoneMap[z] = { zone: z, room_count: 0, occupied_count: 0, revenue: 0, electric_units: 0, water_revenue: 0 };
    zoneMap[z].revenue += Number(inv.total_amount || 0);
    zoneMap[z].electric_units += Number(inv.electric_units || 0);
    zoneMap[z].water_revenue += Number(inv.water_total || 0);
  }

  // Expense Breakdown by Category for the month
  const expenseCatMap = {};
  for (const tx of monthAccounting.filter((t) => t.tx_type === 'expense')) {
    const cat = tx.category || 'อื่นๆ';
    if (!expenseCatMap[cat]) {
      expenseCatMap[cat] = { category: cat, cost_nature: tx.cost_nature, amount: 0, count: 0 };
    }
    expenseCatMap[cat].amount += Number(tx.amount || 0);
    expenseCatMap[cat].count += 1;
  }

  // Top utility rooms for executive insight
  const topElectricRooms = [...monthInvoices]
    .sort((a, b) => Number(b.electric_units || 0) - Number(a.electric_units || 0))
    .slice(0, 5)
    .map((inv) => ({
      room_number: inv.room_number,
      tenant_name: inv.tenant_name,
      electric_units: Number(inv.electric_units || 0),
      electric_total: Number(inv.electric_total || 0),
      total_amount: Number(inv.total_amount || 0)
    }));

  res.json({
    year_be: yearBe,
    month: monthName,
    total_rooms: (rooms || []).length,
    occupied_rooms: (rooms || []).filter((r) => r.status === 'occupied').length,
    occupancy_rate: (rooms || []).length > 0 ? Number((((rooms || []).filter((r) => r.status === 'occupied').length / (rooms || []).length) * 100).toFixed(1)) : 0,
    active_tenants: (tenants || []).length,
    total_occupants: (tenants || []).reduce((s, t) => s + Number(t.occupant_count || 1), 0),
    monthly_summary: monthlySummary,
    yearly_summary: yearlySummary,
    by_month: byMonth,
    by_zone: Object.values(zoneMap),
    expense_by_category: Object.values(expenseCatMap),
    top_electric_rooms: topElectricRooms,
    month_accounting: monthAccounting
  });
});

// 9. Monthly Meter Note-Taking & Retroactive Human Error Correction Endpoints
function getPrevMonthAndYear(monthName, yearBe) {
  const mNum = getMonthNumber(monthName);
  if (mNum === 1) {
    return { month: THAI_MONTHS[11], month_num: 12, year_be: Number(yearBe) - 1 };
  }
  return { month: THAI_MONTHS[mNum - 2], month_num: mNum - 1, year_be: Number(yearBe) };
}

function getNextMonthAndYear(monthName, yearBe) {
  const mNum = getMonthNumber(monthName);
  if (mNum === 12) {
    return { month: THAI_MONTHS[0], month_num: 1, year_be: Number(yearBe) + 1 };
  }
  return { month: THAI_MONTHS[mNum], month_num: mNum + 1, year_be: Number(yearBe) };
}

app.get('/api/meter-notes', async (req, res) => {
  const billingMonth = req.query.billing_month || 'พฤศจิกายน';
  const billingYearBe = Number(req.query.billing_year_be || 2569);
  const zoneFilter = req.query.zone || '';
  const recordedFilter = req.query.recorded_filter || 'all'; // all | recorded | unrecorded
  const search = (req.query.search || '').trim().toLowerCase();
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.max(1, Number(req.query.page_size || 50));

  const prevPeriod = getPrevMonthAndYear(billingMonth, billingYearBe);
  const nextPeriod = getNextMonthAndYear(billingMonth, billingYearBe);

  const [
    { data: rooms, error: roomErr },
    { data: zones },
    { data: tenants },
    { data: currNotes },
    { data: prevNotes },
    { data: currInvoices },
    { data: prevInvoices }
  ] = await Promise.all([
    supabase.from('rooms').select('*').order('sort_order', { ascending: true }).order('room_number', { ascending: true }),
    supabase.from('dorm_zones').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
    supabase.from('tenants').select('*').eq('is_active', true),
    supabase.from('monthly_meter_notes').select('*').eq('billing_month', billingMonth).eq('billing_year_be', billingYearBe),
    supabase.from('monthly_meter_notes').select('*').eq('billing_month', prevPeriod.month).eq('billing_year_be', prevPeriod.year_be),
    supabase.from('invoices').select('*').eq('billing_month', billingMonth).eq('billing_year_be', billingYearBe),
    supabase.from('invoices').select('*').eq('billing_month', prevPeriod.month).eq('billing_year_be', prevPeriod.year_be)
  ]);

  if (roomErr) return res.status(500).json({ error: roomErr.message });

  const tenantMap = {};
  for (const t of tenants || []) {
    if (t.room_id) tenantMap[t.room_id] = t;
    tenantMap[t.room_number] = t;
  }

  const currNoteMap = {};
  for (const n of currNotes || []) currNoteMap[n.room_number] = n;

  const prevNoteMap = {};
  for (const n of prevNotes || []) prevNoteMap[n.room_number] = n;

  const currInvMap = {};
  for (const inv of currInvoices || []) currInvMap[inv.room_number] = inv;

  const prevInvMap = {};
  for (const inv of prevInvoices || []) prevInvMap[inv.room_number] = inv;

  const zoneOrderMap = {};
  for (const z of zones || []) zoneOrderMap[z.name] = z.sort_order ?? 99;

  // Build unified list for all rooms
  const allItems = (rooms || []).map((r) => {
    const activeTenant = tenantMap[r.id] || tenantMap[r.room_number] || null;
    const cNote = currNoteMap[r.room_number];
    const pNote = prevNoteMap[r.room_number];
    const cInv = currInvMap[r.room_number];
    const pInv = prevInvMap[r.room_number];

    // Previous month complete snapshot from Supabase for Popup Comparison
    const prevSource = pNote || pInv || null;
    const prevFormula = prevSource ? buildBillFormulaDetails(prevSource) : null;
    const prevSnapshot = {
      has_prev_record: Boolean(prevSource),
      month: prevPeriod.month,
      year_be: prevPeriod.year_be,
      tenant_name: prevSource?.tenant_name || activeTenant?.name || '',
      room_rate: Number(prevSource?.room_rate ?? r.monthly_rate ?? 0),
      water_calc_type: prevSource?.water_calc_type || r.water_calc_type || 'meter',
      water_prev: String(prevSource?.water_prev ?? ''),
      water_curr: String(prevSource?.water_curr ?? ''),
      water_units: Number(prevSource?.water_units ?? 0),
      water_unit_price: prevSource?.water_unit_price !== undefined ? prevSource.water_unit_price : (r.water_rate ?? 10),
      water_total: Number(prevSource?.water_total ?? 0),
      electric_prev: String(prevSource?.electric_prev ?? ''),
      electric_curr: String(prevSource?.electric_curr ?? ''),
      electric_units: Number(prevSource?.electric_units ?? 0),
      electric_unit_price: Number(prevSource?.electric_unit_price ?? r.electric_rate ?? 8),
      electric_total: Number(prevSource?.electric_total ?? 0),
      other_description: prevSource?.other_description || '',
      other_amount: Number(prevSource?.other_amount ?? 0),
      deposit_deduction: Number(prevSource?.deposit_deduction ?? 0),
      total_amount: Number(prevSource?.total_amount ?? 0),
      formula_expression: prevFormula?.formula_expression || ''
    };

    // Baseline previous meter from previous month's curr reading or room's latest meter
    const baselineWaterPrev = prevSource?.water_curr || cInv?.water_prev || r.latest_water_meter || '';
    const baselineElecPrev = prevSource?.electric_curr || cInv?.electric_prev || r.latest_electric_meter || '';

    if (cNote) {
      const occStatus = cNote.occupancy_status
        || (cNote.note_status === 'vacant' ? 'vacant'
          : (r.status === 'vacant' || r.status === 'available' ? 'vacant'
            : (r.status === 'maintenance' ? 'maintenance' : 'occupied')));
      const isVacant = occStatus === 'vacant';
      const isMaintenance = occStatus === 'maintenance';
      const isRecorded =
        cNote.note_status === 'billed' ||
        cNote.note_status === 'recorded' ||
        String(cNote.electric_curr || '').trim() !== '' ||
        Boolean(cInv);
      const currFormula = buildBillFormulaDetails({
        ...cNote,
        water_rate: r.water_rate,
        electric_rate: r.electric_rate
      });

      return {
        ...cNote,
        zone: r.zone,
        zone_id: r.zone_id,
        zone_sort_order: zoneOrderMap[r.zone] ?? 99,
        sort_order: r.sort_order,
        room_status: r.status,
        occupancy_status: occStatus,
        is_vacant: isVacant,
        is_maintenance: isMaintenance,
        rental_type: r.rental_type,
        has_saved_note: isRecorded,
        is_recorded: isRecorded,
        invoice_id: cInv?.id || null,
        invoice_number: cInv?.invoice_number || null,
        prev_month_name: prevPeriod.month,
        prev_month_year: prevPeriod.year_be,
        prev_electric_units: prevSnapshot.electric_units,
        prev_water_units: prevSnapshot.water_units,
        prev_total_amount: prevSnapshot.total_amount,
        prev_snapshot: prevSnapshot,
        formula_expression: currFormula.formula_expression
      };
    }

    // If not in monthly_meter_notes yet, build ready-to-record item
    const occStatus = (r.status === 'vacant' || r.status === 'available')
      ? 'vacant'
      : (r.status === 'maintenance' ? 'maintenance' : 'occupied');
    const isVacant = occStatus === 'vacant' && !cInv;
    const isMaintenance = occStatus === 'maintenance' && !cInv;
    const occ = activeTenant?.occupant_count || 1;
    const wCalc = r.water_calc_type || 'meter';
    const wRate = Number(r.water_rate || 10);
    const eRate = Number(r.electric_rate || 8);
    const wTotal = isVacant ? 0 : (wCalc === 'per_person' ? occ * 100 : (wCalc === 'flat' ? Number(r.water_flat_amount || 100) : 0));
    const roomRate = isVacant ? 0 : Number(r.monthly_rate || 2500);
    const isRecorded = Boolean(cInv);

    const draftObj = {
      id: null,
      room_id: r.id,
      room_number: r.room_number,
      zone: r.zone,
      zone_id: r.zone_id,
      zone_sort_order: zoneOrderMap[r.zone] ?? 99,
      sort_order: r.sort_order,
      room_status: r.status,
      occupancy_status: cInv ? 'occupied' : occStatus,
      is_vacant: isVacant,
      is_maintenance: isMaintenance,
      rental_type: r.rental_type,
      tenant_id: isVacant ? null : (activeTenant?.id || null),
      tenant_name: cInv?.tenant_name || (isVacant ? '' : (activeTenant?.name || '')),
      billing_month: billingMonth,
      billing_month_num: getMonthNumber(billingMonth),
      billing_year_be: billingYearBe,
      room_rate: cInv ? Number(cInv.room_rate) : roomRate,
      water_calc_type: cInv?.water_calc_type || wCalc,
      water_prev: cInv ? cInv.water_prev : baselineWaterPrev,
      water_curr: cInv ? cInv.water_curr : '',
      water_units: cInv ? Number(cInv.water_units) : 0,
      water_unit_price: wCalc === 'meter' ? wRate : null,
      occupant_count: cInv ? Number(cInv.occupant_count) : occ,
      water_total: cInv ? Number(cInv.water_total) : wTotal,
      electric_prev: cInv ? cInv.electric_prev : baselineElecPrev,
      electric_curr: cInv ? cInv.electric_curr : '',
      electric_units: cInv ? Number(cInv.electric_units) : 0,
      electric_unit_price: eRate,
      electric_total: cInv ? Number(cInv.electric_total) : 0,
      other_description: cInv?.other_description || '',
      other_amount: cInv ? Number(cInv.other_amount || 0) : 0,
      deposit_deduction: cInv ? Number(cInv.deposit_deduction || 0) : 0,
      is_move_out: Boolean(cInv?.is_move_out),
      total_amount: cInv ? Number(cInv.total_amount) : (roomRate + wTotal),
      note_status: cInv ? 'billed' : (isVacant ? 'vacant' : 'pending'),
      admin_correction_reason: '',
      edit_count: 0,
      has_saved_note: isRecorded,
      is_recorded: isRecorded,
      invoice_id: cInv?.id || null,
      invoice_number: cInv?.invoice_number || null,
      prev_month_name: prevPeriod.month,
      prev_month_year: prevPeriod.year_be,
      prev_electric_units: prevSnapshot.electric_units,
      prev_water_units: prevSnapshot.water_units,
      prev_total_amount: prevSnapshot.total_amount,
      prev_snapshot: prevSnapshot,
      notes: ''
    };
    draftObj.formula_expression = buildBillFormulaDetails(draftObj).formula_expression;
    return draftObj;
  });

  // Filter by zone, recorded_filter & search
  const filtered = allItems.filter((item) => {
    if (zoneFilter && item.zone !== zoneFilter) return false;
    if (recordedFilter === 'recorded' && !item.is_recorded) return false;
    if (recordedFilter === 'unrecorded' && (item.is_recorded || item.is_vacant)) return false;
    if (recordedFilter === 'vacant' && !item.is_vacant) return false;
    if (search) {
      const mRoom = (item.room_number || '').toLowerCase().includes(search);
      const mName = (item.tenant_name || '').toLowerCase().includes(search);
      return mRoom || mName;
    }
    return true;
  });

  // Analytics across all rooms for this billing period & next-month projection
  const vacantCount = allItems.filter((i) => i.is_vacant).length;
  const maintenanceCount = allItems.filter((i) => i.is_maintenance).length;
  const activeRoomsCount = allItems.length - vacantCount;
  const recordedCount = allItems.filter((i) => i.is_recorded).length;
  const pendingCount = allItems.filter((i) => !i.is_recorded && !i.is_vacant).length;
  const totalProjectedRevenue = allItems.reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const recordedRevenue = allItems.filter((i) => i.is_recorded).reduce((s, i) => s + Number(i.total_amount || 0), 0);
  const totalElectricUnits = allItems.reduce((s, i) => s + Number(i.electric_units || 0), 0);
  const totalWaterUnits = allItems.reduce((s, i) => s + Number(i.water_units || 0), 0);

  // Detect human-error anomalies (e.g. negative units, or spike > 250 units)
  const anomalies = allItems
    .filter((i) => {
      if (i.electric_curr === '') return false;
      const ePrev = parseFloat(i.electric_prev);
      const eCurr = parseFloat(i.electric_curr);
      if (!isNaN(ePrev) && !isNaN(eCurr) && eCurr < ePrev) return true;
      if (Number(i.electric_units) > 250) return true;
      return false;
    })
    .map((i) => ({
      room_number: i.room_number,
      tenant_name: i.tenant_name,
      issue: parseFloat(i.electric_curr) < parseFloat(i.electric_prev)
        ? 'เลขมิเตอร์หลังจดน้อยกว่าก่อนจด (Human Error)'
        : `หน่วยไฟสูงผิดปกติ (${i.electric_units} หน่วย)`
    }));

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  res.json({
    billing_month: billingMonth,
    billing_year_be: billingYearBe,
    prev_period: prevPeriod,
    next_period: nextPeriod,
    page: safePage,
    page_size: pageSize,
    total_items: filtered.length,
    total_pages: totalPages,
    zones: zones || [],
    summary: {
      total_rooms: allItems.length,
      active_rooms_count: activeRoomsCount,
      vacant_count: vacantCount,
      maintenance_count: maintenanceCount,
      recorded_count: recordedCount,
      pending_count: pendingCount,
      unrecorded_count: pendingCount,
      completion_pct: activeRoomsCount > 0 ? Math.round((recordedCount / activeRoomsCount) * 100) : (allItems.length > 0 ? 100 : 0),
      total_projected_revenue: totalProjectedRevenue,
      recorded_revenue: recordedRevenue,
      total_electric_units: totalElectricUnits,
      total_water_units: totalWaterUnits,
      anomalies
    },
    items: paginatedItems,
    all_rooms_items: allItems,
    all_rooms_overview: allItems.map((i) => ({
      room_number: i.room_number,
      tenant_name: i.tenant_name,
      zone: i.zone,
      note_status: i.note_status,
      is_recorded: i.is_recorded,
      electric_curr: i.electric_curr,
      water_curr: i.water_curr,
      total_amount: i.total_amount,
      edit_count: i.edit_count
    }))
  });
});

// Save or Retroactively Correct a Single Room's Monthly Meter Note (+ Sync Invoice & Next Month's Prev Meter!)
app.post('/api/meter-notes', async (req, res) => {
  const b = req.body;
  const billingMonth = b.billing_month || 'พฤศจิกายน';
  const billingYearBe = Number(b.billing_year_be || 2569);
  const monthNum = getMonthNumber(billingMonth);
  const isRetroactiveCorrection = Boolean(b.is_retroactive_correction);

  // Calculate units & totals accurately
  const wCalc = b.water_calc_type || 'meter';
  let wUnits = 0;
  let wTotal = Number(b.water_total ?? 0);
  const wRate = wCalc === 'meter' ? Number(b.water_unit_price ?? 10) : null;

  if (wCalc === 'meter') {
    const wp = parseFloat(b.water_prev);
    const wc = parseFloat(b.water_curr);
    wUnits = (!isNaN(wp) && !isNaN(wc) && wc >= wp) ? (wc - wp) : 0;
    wTotal = wUnits * (wRate || 10);
  } else if (wCalc === 'per_person') {
    wUnits = 0;
    wTotal = (b.water_total !== undefined && b.water_total !== '' && !isNaN(Number(b.water_total)))
      ? Number(b.water_total)
      : Math.max(1, Number(b.occupant_count || 1)) * 100;
  } else {
    wUnits = 0;
    wTotal = Number(b.water_total ?? 100);
  }

  const ep = parseFloat(b.electric_prev);
  const ec = parseFloat(b.electric_curr);
  const eUnits = (!isNaN(ep) && !isNaN(ec) && ec >= ep) ? (ec - ep) : 0;
  const eRate = Number(b.electric_unit_price ?? 8);
  const eTotal = eUnits * eRate;

  const occupancyStatus = (b.occupancy_status === 'vacant' || b.note_status === 'vacant')
    ? 'vacant'
    : (b.occupancy_status === 'maintenance' ? 'maintenance' : 'occupied');
  const isVacantMonth = occupancyStatus === 'vacant';

  const roomRate = Number(b.room_rate ?? (isVacantMonth ? 0 : 2500));
  const otherAmt = Number(b.other_amount ?? 0);
  const depDeduct = Number(b.deposit_deduction ?? 0);
  const totalAmount = roomRate + wTotal + eTotal + otherAmt - depDeduct;
  const bahtText = toThaiBahtText(totalAmount);

  // Check existing note
  const { data: existingNote } = await supabase
    .from('monthly_meter_notes')
    .select('*')
    .eq('room_number', b.room_number)
    .eq('billing_month', billingMonth)
    .eq('billing_year_be', billingYearBe)
    .maybeSingle();

  const notePayload = {
    room_id: b.room_id || existingNote?.room_id || null,
    room_number: String(b.room_number),
    zone: b.zone || existingNote?.zone || 'ชั้น 1',
    sort_order: Number(b.sort_order ?? existingNote?.sort_order ?? 1),
    tenant_id: b.tenant_id || existingNote?.tenant_id || null,
    tenant_name: String(b.tenant_name || ''),
    billing_month: billingMonth,
    billing_month_num: monthNum,
    billing_year_be: billingYearBe,
    room_rate: roomRate,
    water_calc_type: wCalc,
    water_prev: String(b.water_prev ?? ''),
    water_curr: String(b.water_curr ?? ''),
    water_units: wUnits,
    water_unit_price: wRate,
    occupant_count: Number(b.occupant_count ?? 1),
    water_total: wTotal,
    electric_prev: String(b.electric_prev ?? ''),
    electric_curr: String(b.electric_curr ?? ''),
    electric_units: eUnits,
    electric_unit_price: eRate,
    electric_total: eTotal,
    other_description: String(b.other_description ?? ''),
    other_amount: otherAmt,
    deposit_deduction: depDeduct,
    is_move_out: Boolean(b.is_move_out),
    total_amount: totalAmount,
    occupancy_status: occupancyStatus,
    note_status: isVacantMonth ? 'vacant' : (b.note_status === 'pending' ? 'pending' : (b.save_as_draft ? 'draft' : (b.sync_to_invoice !== false ? 'billed' : 'recorded'))),
    admin_correction_reason: b.admin_correction_reason || existingNote?.admin_correction_reason || '',
    edit_count: (existingNote?.edit_count || 0) + (isRetroactiveCorrection ? 1 : 0),
    last_edited_at: new Date().toISOString(),
    notes: b.notes || '',
    updated_at: new Date().toISOString()
  };

  let savedNote;
  if (existingNote?.id) {
    const { data, error } = await supabase
      .from('monthly_meter_notes')
      .update(notePayload)
      .eq('id', existingNote.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    savedNote = data;
  } else {
    const { data, error } = await supabase
      .from('monthly_meter_notes')
      .insert(notePayload)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    savedNote = data;
  }

  if (b.also_update_room_status && savedNote.room_id) {
    await supabase
      .from('rooms')
      .update({ status: occupancyStatus, updated_at: new Date().toISOString() })
      .eq('id', savedNote.room_id);
  }

  // Sync to invoices table so receipts & dashboard reflect the note / retroactive fix immediately (skip auto-invoice for vacant rooms)
  let savedInvoice = null;
  if (b.sync_to_invoice !== false && !isVacantMonth) {
    const { data: settings } = await supabase.from('payment_settings').select('*').limit(1).maybeSingle();
    const { data: existingInv } = await supabase
      .from('invoices')
      .select('*')
      .eq('room_number', b.room_number)
      .eq('billing_month', billingMonth)
      .eq('billing_year_be', billingYearBe)
      .eq('invoice_type', 'monthly')
      .maybeSingle();

    const invPayload = {
      invoice_number: existingInv?.invoice_number || `INV-${billingYearBe}${String(monthNum).padStart(2, '0')}-${b.room_number}-${Date.now().toString().slice(-3)}`,
      room_id: savedNote.room_id,
      tenant_id: savedNote.tenant_id,
      room_number: savedNote.room_number,
      tenant_name: savedNote.tenant_name,
      invoice_type: 'monthly',
      doc_day: '1',
      billing_month: billingMonth,
      billing_month_num: monthNum,
      billing_year_be: billingYearBe,
      room_rate: roomRate,
      room_rate_label: `ค่าห้องเดือน...${billingMonth}`,
      days_count: 1,
      water_calc_type: wCalc,
      water_prev: savedNote.water_prev,
      water_curr: savedNote.water_curr,
      water_units: wUnits,
      water_unit_price: wRate,
      occupant_count: savedNote.occupant_count,
      water_total: wTotal,
      electric_prev: savedNote.electric_prev,
      electric_curr: savedNote.electric_curr,
      electric_units: eUnits,
      electric_unit_price: eRate,
      electric_total: eTotal,
      other_description: savedNote.other_description,
      other_amount: otherAmt,
      deposit_deduction: depDeduct,
      is_move_out: savedNote.is_move_out,
      total_amount: totalAmount,
      baht_text: bahtText,
      status: 'paid',
      bank_name_snapshot: settings?.bank_name || 'ธ.ก.ส.',
      account_number_snapshot: settings?.account_number || '017562024411',
      account_holder_snapshot: settings?.account_holder || 'นาง เอมอร ไทยนอ',
      qr_caption_snapshot: settings?.qr_caption || 'นาง เอมอร ไทยนอ',
      updated_at: new Date().toISOString()
    };

    if (existingInv?.id) {
      const { data: invUpd } = await supabase.from('invoices').update(invPayload).eq('id', existingInv.id).select().single();
      savedInvoice = invUpd;
    } else {
      const { data: invIns } = await supabase.from('invoices').insert(invPayload).select().single();
      savedInvoice = invIns;
    }
  }

  // Update room's latest meter reading if current reading is provided
  if (savedNote.room_id) {
    const roomUpd = { updated_at: new Date().toISOString() };
    if (savedNote.water_curr !== '') roomUpd.latest_water_meter = savedNote.water_curr;
    if (savedNote.electric_curr !== '') roomUpd.latest_electric_meter = savedNote.electric_curr;
    await supabase.from('rooms').update(roomUpd).eq('id', savedNote.room_id);
  }

  // CRITICAL: If Admin retroactively corrected a past month's meter (Human Error fix),
  // automatically cascade the corrected current meter to the NEXT month's `water_prev` and `electric_prev`!
  const nextPeriod = getNextMonthAndYear(billingMonth, billingYearBe);
  const { data: nextNote } = await supabase
    .from('monthly_meter_notes')
    .select('*')
    .eq('room_number', savedNote.room_number)
    .eq('billing_month', nextPeriod.month)
    .eq('billing_year_be', nextPeriod.year_be)
    .maybeSingle();

  if (nextNote) {
    const nWaterPrev = savedNote.water_curr || nextNote.water_prev;
    const nElecPrev = savedNote.electric_curr || nextNote.electric_prev;
    const nEp = parseFloat(nElecPrev);
    const nEc = parseFloat(nextNote.electric_curr);
    const nEUnits = (!isNaN(nEp) && !isNaN(nEc) && nEc >= nEp) ? (nEc - nEp) : 0;
    const nETotal = nEUnits * Number(nextNote.electric_unit_price || 8);

    let nWUnits = nextNote.water_units;
    let nWTotal = nextNote.water_total;
    if (nextNote.water_calc_type === 'meter') {
      const nWp = parseFloat(nWaterPrev);
      const nWc = parseFloat(nextNote.water_curr);
      nWUnits = (!isNaN(nWp) && !isNaN(nWc) && nWc >= nWp) ? (nWc - nWp) : 0;
      nWTotal = nWUnits * Number(nextNote.water_unit_price || 10);
    }
    const nTotal = Number(nextNote.room_rate || 0) + Number(nWTotal || 0) + nETotal + Number(nextNote.other_amount || 0) - Number(nextNote.deposit_deduction || 0);

    await supabase
      .from('monthly_meter_notes')
      .update({
        water_prev: nWaterPrev,
        water_units: nWUnits,
        water_total: nWTotal,
        electric_prev: nElecPrev,
        electric_units: nEUnits,
        electric_total: nETotal,
        total_amount: nTotal,
        updated_at: new Date().toISOString()
      })
      .eq('id', nextNote.id);
  }

  await recordLog({
    action_type: isRetroactiveCorrection ? 'HUMAN_ERROR_CORRECTION' : 'METER_NOTE_SAVED',
    room_id: savedNote.room_id,
    room_number: savedNote.room_number,
    tenant_id: savedNote.tenant_id,
    tenant_name: savedNote.tenant_name,
    description: isRetroactiveCorrection
      ? `[แอดมินแก้ไขย้อนหลัง Human Error] ห้อง ${savedNote.room_number} (${savedNote.tenant_name}) เดือน ${billingMonth} ${billingYearBe} — มิเตอร์น้ำ: ${savedNote.water_prev}→${savedNote.water_curr}, มิเตอร์ไฟ: ${savedNote.electric_prev}→${savedNote.electric_curr} ยอดรวมใหม่ ${Number(totalAmount).toLocaleString()} บ. เหตุผล: ${b.admin_correction_reason || 'แก้ไขตัวเลขมิเตอร์ที่จดคลาดเคลื่อน'}`
      : `จดบันทึกมิเตอร์ประจำเดือน ${billingMonth} ${billingYearBe} ห้อง ${savedNote.room_number} (${savedNote.tenant_name}) — น้ำ: ${savedNote.water_prev}→${savedNote.water_curr} (${wTotal} บ.), ไฟ: ${savedNote.electric_prev}→${savedNote.electric_curr} (${eTotal} บ.) รวม ${Number(totalAmount).toLocaleString()} บ.`,
    amount: totalAmount,
    metadata: {
      billing_month: billingMonth,
      billing_year_be: billingYearBe,
      is_retroactive_correction: isRetroactiveCorrection,
      admin_correction_reason: b.admin_correction_reason || '',
      water_prev: savedNote.water_prev,
      water_curr: savedNote.water_curr,
      water_total: wTotal,
      electric_prev: savedNote.electric_prev,
      electric_curr: savedNote.electric_curr,
      electric_total: eTotal,
      total_amount: totalAmount
    }
  });

  // Sub-Agent Per-Bill Equation Audit Log (Supabase bill_audit_logs)
  const auditResult = await runBillAuditSubAgent(
    supabase,
    { ...savedNote, water_rate: wRate ?? savedNote.water_total, electric_rate: eRate },
    {
      invoice_id: savedInvoice?.id || null,
      meter_note_id: savedNote.id,
      action_status: isRetroactiveCorrection ? 'retroactive_fix' : (existingNote?.id ? 'updated' : 'recorded'),
      notes: isRetroactiveCorrection
        ? `แก้ไขย้อนหลัง: ${b.admin_correction_reason || 'Human Error'}`
        : (b.notes || 'บันทึกจากหน้าต่างป๊อปอัปจดบิลรายเดือน')
    }
  );

  res.json({
    ...savedNote,
    is_recorded: savedNote.note_status === 'billed' || savedNote.note_status === 'recorded' || savedNote.electric_curr !== '',
    invoice: savedInvoice,
    bill_audit_log: auditResult.log || null,
    formula: auditResult.formula
  });
});

// Clear Monthly Recording for a Specific Room (Resets to 'unrecorded/pending' while preserving tenant, rates & history)
app.post('/api/meter-notes/clear', async (req, res) => {
  const roomNumber = String(req.body.room_number || '').trim();
  const billingMonth = String(req.body.billing_month || '').trim();
  const billingYearBe = Number(req.body.billing_year_be || 2569);

  if (!roomNumber || !billingMonth) {
    return res.status(400).json({ error: 'กรุณาระบุห้องและเดือนที่ต้องการเคลียร์ค่า' });
  }

  const prevPeriod = getPrevMonthAndYear(billingMonth, billingYearBe);
  const [{ data: room }, { data: prevNote }, { data: prevInv }, { data: activeTenant }] = await Promise.all([
    supabase.from('rooms').select('*').eq('room_number', roomNumber).maybeSingle(),
    supabase.from('monthly_meter_notes').select('water_curr, electric_curr').eq('room_number', roomNumber).eq('billing_month', prevPeriod.month).eq('billing_year_be', prevPeriod.year_be).maybeSingle(),
    supabase.from('invoices').select('water_curr, electric_curr').eq('room_number', roomNumber).eq('billing_month', prevPeriod.month).eq('billing_year_be', prevPeriod.year_be).maybeSingle(),
    supabase.from('tenants').select('id, name').eq('room_number', roomNumber).eq('is_active', true).maybeSingle()
  ]);

  // 1. Delete this month's meter note & monthly invoice (leaves all other months & history intact)
  const [{ error: delNoteErr }, { error: delInvErr }] = await Promise.all([
    supabase
      .from('monthly_meter_notes')
      .delete()
      .eq('room_number', roomNumber)
      .eq('billing_month', billingMonth)
      .eq('billing_year_be', billingYearBe),
    supabase
      .from('invoices')
      .delete()
      .eq('room_number', roomNumber)
      .eq('billing_month', billingMonth)
      .eq('billing_year_be', billingYearBe)
      .eq('invoice_type', 'monthly')
  ]);

  if (delNoteErr) return res.status(500).json({ error: delNoteErr.message });
  if (delInvErr) return res.status(500).json({ error: delInvErr.message });

  // 2. Restore room latest meters to previous month's ending meter (if available) and keep room status occupied if requested
  if (room?.id) {
    const restoredWater = prevNote?.water_curr || prevInv?.water_curr || room.latest_water_meter || '';
    const restoredElec = prevNote?.electric_curr || prevInv?.electric_curr || room.latest_electric_meter || '';
    const roomPatch = {
      latest_water_meter: String(restoredWater),
      latest_electric_meter: String(restoredElec),
      updated_at: new Date().toISOString()
    };
    if (req.body.reset_room_status_to_occupied && (room.status === 'vacant' || room.status === 'available')) {
      roomPatch.status = 'occupied';
    }
    await supabase.from('rooms').update(roomPatch).eq('id', room.id);
  }

  await recordLog({
    action_type: 'CLEAR_MONTHLY_NOTE',
    room_id: room?.id || null,
    room_number: roomNumber,
    tenant_id: activeTenant?.id || null,
    tenant_name: activeTenant?.name || '',
    description: `เคลียร์ค่าบันทึกบิลเดือน ${billingMonth} ${billingYearBe} ห้อง ${roomNumber} (กลับเป็นสถานะยังไม่บันทึก คงข้อมูลผู้เช่าและอัตราเรทเดิม)`
  });

  res.json({ success: true, room_number: roomNumber, billing_month: billingMonth, billing_year_be: billingYearBe });
});

// Initialize / Carry-over Meter Notes for Next Billing Month Automatically
app.post('/api/meter-notes/prepare-next-month', async (req, res) => {
  const { from_month, from_year_be, target_month, target_year_be } = req.body;
  const sourcePeriod = {
    month: from_month || 'พฤศจิกายน',
    year_be: Number(from_year_be || 2569)
  };
  const nextPeriod = target_month
    ? { month: target_month, month_num: getMonthNumber(target_month), year_be: Number(target_year_be || 2569) }
    : getNextMonthAndYear(sourcePeriod.month, sourcePeriod.year_be);

  const [{ data: rooms }, { data: tenants }, { data: sourceNotes }, { data: sourceInvoices }] = await Promise.all([
    supabase.from('rooms').select('*').order('sort_order', { ascending: true }),
    supabase.from('tenants').select('*').eq('is_active', true),
    supabase.from('monthly_meter_notes').select('*').eq('billing_month', sourcePeriod.month).eq('billing_year_be', sourcePeriod.year_be),
    supabase.from('invoices').select('*').eq('billing_month', sourcePeriod.month).eq('billing_year_be', sourcePeriod.year_be)
  ]);

  const tenantMap = {};
  for (const t of tenants || []) {
    if (t.room_id) tenantMap[t.room_id] = t;
    tenantMap[t.room_number] = t;
  }
  const sNoteMap = {};
  for (const n of sourceNotes || []) sNoteMap[n.room_number] = n;
  const sInvMap = {};
  for (const inv of sourceInvoices || []) sInvMap[inv.room_number] = inv;

  let preparedCount = 0;
  for (const r of rooms || []) {
    const activeTenant = tenantMap[r.id] || tenantMap[r.room_number];
    const sn = sNoteMap[r.room_number];
    const si = sInvMap[r.room_number];

    const isVacantRoom = r.status === 'vacant' || r.status === 'available';
    const occStatus = isVacantRoom ? 'vacant' : (r.status === 'maintenance' ? 'maintenance' : 'occupied');
    const waterPrev = sn?.water_curr || si?.water_curr || r.latest_water_meter || '';
    const elecPrev = sn?.electric_curr || si?.electric_curr || r.latest_electric_meter || '';
    const occ = activeTenant?.occupant_count || 1;
    const wCalc = r.water_calc_type || 'meter';
    const wTotal = isVacantRoom ? 0 : (wCalc === 'per_person' ? occ * 100 : (wCalc === 'flat' ? Number(r.water_flat_amount || 100) : 0));
    const roomRate = isVacantRoom ? 0 : Number(r.monthly_rate || 2500);

    const payload = {
      room_id: r.id,
      room_number: r.room_number,
      zone: r.zone,
      sort_order: r.sort_order,
      tenant_id: isVacantRoom ? null : (activeTenant?.id || null),
      tenant_name: isVacantRoom ? '' : (activeTenant?.name || ''),
      billing_month: nextPeriod.month,
      billing_month_num: nextPeriod.month_num,
      billing_year_be: nextPeriod.year_be,
      room_rate: roomRate,
      water_calc_type: wCalc,
      water_prev: waterPrev,
      water_curr: '',
      water_units: 0,
      water_unit_price: wCalc === 'meter' ? Number(r.water_rate || 10) : null,
      occupant_count: occ,
      water_total: wTotal,
      electric_prev: elecPrev,
      electric_curr: '',
      electric_units: 0,
      electric_unit_price: Number(r.electric_rate || 8),
      electric_total: 0,
      other_description: '',
      other_amount: 0,
      deposit_deduction: 0,
      is_move_out: false,
      total_amount: roomRate + wTotal,
      occupancy_status: occStatus,
      note_status: isVacantRoom ? 'vacant' : 'pending',
      notes: isVacantRoom
        ? `ห้องว่าง — เตรียมรอบบิลจาก ${sourcePeriod.month} ${sourcePeriod.year_be}`
        : `ดึงเลขมิเตอร์ตั้งต้นจากเดือน ${sourcePeriod.month} ${sourcePeriod.year_be}`
    };

    const { error } = await supabase
      .from('monthly_meter_notes')
      .upsert(payload, { onConflict: 'room_number,billing_month,billing_year_be' });
    if (!error) preparedCount++;
  }

  await recordLog({
    action_type: 'NEXT_MONTH_PREPARED',
    description: `เตรียมสมุดจดมิเตอร์สำหรับรอบบิลถัดไป (${nextPeriod.month} ${nextPeriod.year_be}) จำนวน ${preparedCount} ห้อง โดยดึงเลขมิเตอร์หลังจดจากเดือน ${sourcePeriod.month} ${sourcePeriod.year_be}`
  });

  res.json({
    success: true,
    prepared_count: preparedCount,
    target_month: nextPeriod.month,
    target_year_be: nextPeriod.year_be
  });
});

const PORT = process.env.PORT || 3045;
if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  app.listen(PORT, () => {
    console.log(`🚀 Dormitory Billing Backend running on http://localhost:${PORT}`);
  });
  // Keep event loop alive
  setInterval(() => {}, 1 << 30);
}

export default app;
