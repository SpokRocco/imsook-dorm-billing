import React, { useState } from 'react';
import {
  MapPin, Building2, Users, Plus, Edit3, Trash2, ArrowRightLeft, FileImage, Phone, X, Check
} from 'lucide-react';
import { formatCurrency } from '../utils/bahtText.js';

const COLOR_OPTIONS = [
  { id: 'amber', label: 'ทอง / อำพัน', dot: 'bg-amber-500' },
  { id: 'emerald', label: 'เขียวมรกต', dot: 'bg-emerald-600' },
  { id: 'indigo', label: 'น้ำเงินคราม', dot: 'bg-indigo-600' },
  { id: 'sky', label: 'ฟ้าสดใส', dot: 'bg-sky-500' },
  { id: 'rose', label: 'แดงกุหลาบ', dot: 'bg-rose-500' },
  { id: 'violet', label: 'ม่วงไวโอเล็ต', dot: 'bg-purple-600' }
];

export default function RoomsZonesTenantsView({
  rooms = [],
  zones = [],
  tenants = [],
  onRefreshAll,
  showToast,
  initialSubTab = 'zones'
}) {
  const [subTab, setSubTab] = useState(initialSubTab); // 'zones' | 'rooms' | 'tenants'
  const [zoneFilter, setZoneFilter] = useState('');

  // Zone modal
  const [zoneModal, setZoneModal] = useState(null);
  const [savingZone, setSavingZone] = useState(false);

  // Room modal
  const [roomModal, setRoomModal] = useState(null);
  const [savingRoom, setSavingRoom] = useState(false);

  // Tenant modal & Transfer modal & Image Lightbox
  const [tenantModal, setTenantModal] = useState(null);
  const [transferModal, setTransferModal] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);

  const findTenantObj = (id) => tenants.find((t) => t.id === id);

  // --- ZONE HANDLERS ---
  const openNewZone = () => {
    setZoneModal({
      id: null,
      name: '',
      code: '',
      description: '',
      color_theme: 'emerald',
      sort_order: (zones?.length || 0) + 1
    });
  };

  const saveZone = async (e) => {
    e.preventDefault();
    if (!zoneModal?.name?.trim()) return;
    setSavingZone(true);
    try {
      const url = zoneModal.id ? `/api/zones/${zoneModal.id}` : '/api/zones';
      const method = zoneModal.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoneModal)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกโซนไม่สำเร็จ');
      if (showToast) showToast(`บันทึกโซน "${data.name}" เรียบร้อย`);
      setZoneModal(null);
      if (onRefreshAll) await onRefreshAll();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setSavingZone(false);
    }
  };

  const deleteZone = async (z) => {
    if (!window.confirm(`ต้องการลบโซน "${z.name}" หรือไม่?`)) return;
    try {
      const res = await fetch(`/api/zones/${z.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบโซนไม่สำเร็จ');
      if (showToast) showToast(`ลบโซน "${z.name}" เรียบร้อย`);
      if (onRefreshAll) await onRefreshAll();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  // --- ROOM HANDLERS ---
  const openRoomForm = (room = null) => {
    if (room) {
      setRoomModal({
        id: room.id,
        room_number: room.room_number,
        zone: room.zone || zones[0]?.name || 'ชั้น 1',
        rental_type: room.rental_type || 'monthly',
        monthly_rate: room.monthly_rate ?? 2500,
        daily_rate: room.daily_rate ?? 350,
        water_calc_type: room.water_calc_type || 'meter',
        water_rate: room.water_rate ?? 10,
        water_flat_amount: room.water_flat_amount ?? 100,
        electric_rate: room.electric_rate ?? 8,
        latest_water_meter: room.latest_water_meter || '',
        latest_electric_meter: room.latest_electric_meter || '',
        tenant_name: room.active_tenant?.name || '',
        tenant_phone: room.active_tenant?.phone || '',
        occupant_count: room.active_tenant?.occupant_count ?? 1,
        deposit_amount: room.active_tenant?.deposit_amount ?? 2500,
        status: room.status || 'available',
        notes: room.notes || ''
      });
    } else {
      setRoomModal({
        id: null,
        room_number: '',
        zone: zones[0]?.name || 'ชั้น 1',
        rental_type: 'monthly',
        monthly_rate: 2500,
        daily_rate: 350,
        water_calc_type: 'meter',
        water_rate: 10,
        water_flat_amount: 100,
        electric_rate: 8,
        latest_water_meter: '',
        latest_electric_meter: '',
        tenant_name: '',
        tenant_phone: '',
        occupant_count: 1,
        deposit_amount: 2500,
        status: 'available',
        notes: ''
      });
    }
  };

  const saveRoomForm = async (e) => {
    e.preventDefault();
    if (!roomModal?.room_number?.trim()) return;
    setSavingRoom(true);
    try {
      const url = roomModal.id ? `/api/rooms/${roomModal.id}` : '/api/rooms';
      const method = roomModal.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomModal)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกห้องพักไม่สำเร็จ');
      if (showToast) showToast(`บันทึกข้อมูลห้อง ${data.room_number} (โซน ${data.zone}) เรียบร้อย`);
      setRoomModal(null);
      if (onRefreshAll) await onRefreshAll();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setSavingRoom(false);
    }
  };

  // --- TENANT HANDLERS ---
  const openTenantForm = (tenant = null) => {
    if (tenant) {
      setTenantModal({ ...tenant });
    } else {
      setTenantModal({
        id: null,
        name: '',
        room_id: '',
        room_number: '',
        phone: '',
        id_card: '',
        home_address: '',
        emergency_contact: '',
        rental_type: 'monthly',
        occupant_count: 1,
        deposit_amount: 2500,
        check_in_date: new Date().toISOString().slice(0, 10),
        is_active: true,
        id_card_image_url: null,
        house_reg_image_url: null,
        notes: ''
      });
    }
  };

  const handleUploadTenantFile = (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setTenantModal((prev) => ({ ...prev, [field]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const saveTenantForm = async (e) => {
    e.preventDefault();
    if (!tenantModal?.name?.trim()) return;
    try {
      const url = tenantModal.id ? `/api/tenants/${tenantModal.id}` : '/api/tenants';
      const method = tenantModal.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantModal)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกข้อมูลผู้เช่าไม่สำเร็จ');
      if (showToast) showToast(`บันทึกประวัติผู้เช่า "${data.name}" เรียบร้อย`);
      setTenantModal(null);
      if (onRefreshAll) await onRefreshAll();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const submitTransfer = async (e) => {
    e.preventDefault();
    if (!transferModal) return;
    try {
      const res = await fetch(`/api/tenants/${transferModal.tenant.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: transferModal.event_type,
          new_room_number: transferModal.new_room_number,
          event_date: transferModal.event_date,
          rate_amount: transferModal.rate_amount,
          deposit_amount: transferModal.deposit_amount,
          notes: transferModal.notes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกการย้ายห้องไม่สำเร็จ');
      if (showToast) showToast('บันทึกประวัติการย้ายห้อง/ย้ายออกเรียบร้อย');
      setTransferModal(null);
      if (onRefreshAll) await onRefreshAll();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    }
  };

  const filteredRooms = rooms.filter((r) => !zoneFilter || r.zone === zoneFilter);

  return (
    <div className="space-y-5">
      {/* Header & Sub-Tab Controls */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            แบ่งโซนบริเวณหอพัก • ห้องพัก &amp; ฐานข้อมูลผู้เช่า
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            จัดการโซนบริเวณหอพักอิ่มสุข ตั้งค่าห้องพัก เก็บสำเนาเอกสารบัตรประชาชน/ทะเบียนบ้าน (ไม่บังคับ) และดูประวัติย้ายห้องย้อนหลัง
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setSubTab('zones')}
              className={`px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                subTab === 'zones' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-600'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>โซนหอพัก ({zones.length})</span>
            </button>
            <button
              onClick={() => setSubTab('rooms')}
              className={`px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                subTab === 'rooms' ? 'bg-slate-900 text-white shadow' : 'text-slate-600'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>ห้องพัก ({rooms.length})</span>
            </button>
            <button
              onClick={() => setSubTab('tenants')}
              className={`px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 ${
                subTab === 'tenants' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>ลูกค้า/ย้ายห้อง ({tenants.length})</span>
            </button>
          </div>

          {subTab === 'zones' && (
            <button
              onClick={openNewZone}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs sm:text-sm shadow cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มโซนใหม่</span>
            </button>
          )}
          {subTab === 'rooms' && (
            <button
              onClick={() => openRoomForm()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs sm:text-sm shadow cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มห้องพักใหม่</span>
            </button>
          )}
          {subTab === 'tenants' && (
            <button
              onClick={() => openTenantForm()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs sm:text-sm shadow cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>ลงทะเบียนลูกค้าใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* SUB-TAB 1: ZONES MANAGEMENT */}
      {subTab === 'zones' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((z) => {
            const dotCls = COLOR_OPTIONS.find((c) => c.id === z.color_theme)?.dot || 'bg-emerald-600';
            return (
              <div key={z.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-4 h-4 rounded-full ${dotCls} shrink-0`} />
                      <div>
                        <h3 className="text-lg font-extrabold text-slate-900">{z.name}</h3>
                        <span className="text-[11px] font-mono text-slate-400">รหัส: {z.code || '-'} • ลำดับ {z.sort_order}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setZoneModal({ ...z })}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        title="แก้ไขโซน"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteZone(z)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                        title="ลบโซน"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">{z.description || 'ไม่มีคำอธิบายโซน'}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="space-x-2">
                    <span className="font-extrabold text-slate-900">{z.room_count ?? 0} ห้อง</span>
                    <span className="text-emerald-700 font-bold">(มีผู้เช่า {z.occupied_count ?? 0})</span>
                  </div>
                  <button
                    onClick={() => {
                      setZoneFilter(z.name);
                      setSubTab('rooms');
                    }}
                    className="text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    ดูห้องในโซนนี้ →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 2: ROOMS TABLE & MOBILE CARDS */}
      {subTab === 'rooms' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setZoneFilter('')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                zoneFilter === '' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              ทุกโซน ({rooms.length})
            </button>
            {zones.map((z) => (
              <button
                key={z.id}
                onClick={() => setZoneFilter(z.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  zoneFilter === z.name ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {z.name}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white uppercase">
                    <th className="p-3">ห้อง</th>
                    <th className="p-3">โซน</th>
                    <th className="p-3">ผู้เช่าปัจจุบัน</th>
                    <th className="p-3 text-right">ค่าเช่า/เดือน</th>
                    <th className="p-3">ค่าน้ำ</th>
                    <th className="p-3 text-center">ค่าไฟ</th>
                    <th className="p-3 text-center">มิเตอร์ล่าสุด (น้ำ/ไฟ)</th>
                    <th className="p-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredRooms.map((rm) => (
                    <tr key={rm.id} className="hover:bg-slate-50">
                      <td className="p-3 font-extrabold text-slate-900 text-sm">{rm.room_number}</td>
                      <td className="p-3 font-semibold text-slate-600">{rm.zone}</td>
                      <td className="p-3">
                        <div className="font-bold text-emerald-700">{rm.active_tenant?.name || 'ว่าง'}</div>
                        {rm.active_tenant?.phone && <div className="text-[11px] text-slate-400">{rm.active_tenant.phone}</div>}
                      </td>
                      <td className="p-3 text-right font-bold">฿{formatCurrency(rm.monthly_rate)}</td>
                      <td className="p-3">
                        {rm.water_calc_type === 'meter'
                          ? `มิเตอร์ (${rm.water_rate} บ./หน่วย)`
                          : `เหมาจ่าย (${rm.water_calc_type === 'per_person' ? `${(rm.active_tenant?.occupant_count || 1) * 100}` : rm.water_flat_amount} บ.)`}
                      </td>
                      <td className="p-3 text-center font-bold text-amber-700">{rm.electric_rate} บ.</td>
                      <td className="p-3 text-center font-mono">
                        💧{rm.latest_water_meter || '-'} / ⚡{rm.latest_electric_meter || '-'}
                      </td>
                      <td className="p-3 text-center space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => openRoomForm(rm)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                        >
                          แก้ไขห้อง
                        </button>
                        {rm.active_tenant && (
                          <button
                            onClick={() => {
                              const t = findTenantObj(rm.active_tenant.id);
                              if (t) openTenantForm(t);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold cursor-pointer"
                          >
                            แฟ้มผู้เช่า
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredRooms.map((rm) => (
                <div key={rm.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-extrabold text-slate-900 text-base">ห้อง {rm.room_number}</span>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">{rm.zone}</span>
                    </div>
                    <button
                      onClick={() => openRoomForm(rm)}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                    >
                      แก้ไข
                    </button>
                  </div>
                  <div className="text-xs text-slate-600 flex items-center justify-between">
                    <span>ผู้เช่า: <strong className="text-emerald-700">{rm.active_tenant?.name || 'ว่าง'}</strong></span>
                    <span className="font-bold">฿{formatCurrency(rm.monthly_rate)}/ด.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: TENANTS & DOCS & TRANSFER TIMELINE */}
      {subTab === 'tenants' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tenants.map((t) => (
            <div key={t.id} className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900">{t.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      t.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {t.is_active ? `พักอยู่ห้อง ${t.room_number}` : `ย้ายออกแล้ว (${t.room_number})`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-3">
                    {t.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {t.phone}</span>}
                    <span>มัดจำ: ฿{formatCurrency(t.deposit_amount)}</span>
                    <span>ยอดชำระสะสม: <strong className="text-emerald-700">฿{formatCurrency(t.total_paid || 0)}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => openTenantForm(t)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
                  >
                    แก้ไข/เอกสาร
                  </button>
                  <button
                    onClick={() => setTransferModal({
                      tenant: t,
                      event_type: 'room_transfer',
                      new_room_number: rooms[0]?.room_number || t.room_number,
                      event_date: new Date().toISOString().slice(0, 10),
                      rate_amount: 2500,
                      deposit_amount: t.deposit_amount ?? 2500,
                      notes: ''
                    })}
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold cursor-pointer flex items-center gap-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>ย้ายห้อง</span>
                  </button>
                </div>
              </div>

              {/* Optional ID Card & House Reg Thumbnails */}
              {(t.id_card_image_url || t.house_reg_image_url) && (
                <div className="flex items-center gap-3 pt-1">
                  {t.id_card_image_url && (
                    <button
                      type="button"
                      onClick={() => setLightboxImg({ url: t.id_card_image_url, title: `บัตรประชาชน — ${t.name}` })}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 cursor-pointer"
                    >
                      <FileImage className="w-3.5 h-3.5" />
                      <span>ดูรูปบัตร ปชช.</span>
                    </button>
                  )}
                  {t.house_reg_image_url && (
                    <button
                      type="button"
                      onClick={() => setLightboxImg({ url: t.house_reg_image_url, title: `ทะเบียนบ้าน — ${t.name}` })}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sky-50 border border-sky-200 text-xs font-bold text-sky-800 cursor-pointer"
                    >
                      <FileImage className="w-3.5 h-3.5" />
                      <span>ดูทะเบียนบ้าน</span>
                    </button>
                  )}
                </div>
              )}

              {/* Stay History Timeline */}
              {t.stays && t.stays.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 space-y-1">
                  <div className="text-[11px] font-bold text-slate-600">ประวัติการเข้าพัก/ย้ายห้อง:</div>
                  {t.stays.slice(0, 4).map((st) => (
                    <div key={st.id} className="text-[11px] text-slate-600 flex items-center justify-between">
                      <span>• {st.event_type === 'room_transfer' ? `ย้ายเข้าห้อง ${st.room_number}` : st.event_type === 'move_out' ? `ย้ายออกจาก ${st.room_number}` : `เข้าพัก ${st.room_number}`}</span>
                      <span className="text-slate-400">{st.start_date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ZONE MODAL */}
      {zoneModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={saveZone} className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">
                {zoneModal.id ? 'แก้ไขโซนบริเวณหอพัก' : 'เพิ่มโซนบริเวณหอพักใหม่'}
              </h3>
              <button type="button" onClick={() => setZoneModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">ชื่อโซน *</label>
                <input
                  required
                  value={zoneModal.name}
                  onChange={(e) => setZoneModal({ ...zoneModal, name: e.target.value })}
                  placeholder="เช่น โซนบ้านพัก 320, ชั้น 3 อาคารใหม่"
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">รหัสโซน</label>
                  <input
                    value={zoneModal.code}
                    onChange={(e) => setZoneModal({ ...zoneModal, code: e.target.value })}
                    placeholder="เช่น Z320, F3"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ลำดับการแสดง</label>
                  <input
                    type="number"
                    value={zoneModal.sort_order}
                    onChange={(e) => setZoneModal({ ...zoneModal, sort_order: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">สีประจำโซน</label>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setZoneModal({ ...zoneModal, color_theme: c.id })}
                      className={`px-2.5 py-2 rounded-xl border text-left flex items-center gap-2 cursor-pointer ${
                        zoneModal.color_theme === c.id ? 'border-slate-900 bg-slate-100 font-bold' : 'border-slate-200'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${c.dot}`} />
                      <span className="truncate">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">คำอธิบาย</label>
                <textarea
                  rows={2}
                  value={zoneModal.description}
                  onChange={(e) => setZoneModal({ ...zoneModal, description: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setZoneModal(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-xs cursor-pointer">
                ยกเลิก
              </button>
              <button type="submit" disabled={savingZone} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow cursor-pointer flex items-center gap-1">
                <Check className="w-4 h-4" />
                <span>{savingZone ? 'กำลังบันทึก...' : 'บันทึกโซน'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ROOM MODAL */}
      {roomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={saveRoomForm} className="bg-white w-full max-w-xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">
                {roomModal.id ? `แก้ไขข้อมูลห้อง ${roomModal.room_number}` : 'เพิ่มห้องพักใหม่'}
              </h3>
              <button type="button" onClick={() => setRoomModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">หมายเลขห้อง *</label>
                <input
                  required
                  value={roomModal.room_number}
                  onChange={(e) => setRoomModal({ ...roomModal, room_number: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">โซนบริเวณหอพัก *</label>
                <select
                  value={roomModal.zone}
                  onChange={(e) => setRoomModal({ ...roomModal, zone: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-bold"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.name}>{z.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">ค่าเช่ารายเดือน (บาท)</label>
                <input
                  type="number"
                  value={roomModal.monthly_rate}
                  onChange={(e) => setRoomModal({ ...roomModal, monthly_rate: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">วิธีคิดค่าน้ำ</label>
                <select
                  value={roomModal.water_calc_type}
                  onChange={(e) => setRoomModal({ ...roomModal, water_calc_type: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="meter">คิดตามมิเตอร์น้ำ</option>
                  <option value="per_person">เหมาจ่ายตามจำนวนคน</option>
                  <option value="flat">เหมาจ่ายคงที่</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">เรทค่าน้ำ / เรทค่าไฟ</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={roomModal.water_rate}
                    onChange={(e) => setRoomModal({ ...roomModal, water_rate: Number(e.target.value) })}
                    className="w-1/2 border border-slate-300 rounded-xl px-2.5 py-2 text-sm"
                    placeholder="น้ำ"
                  />
                  <input
                    type="number"
                    value={roomModal.electric_rate}
                    onChange={(e) => setRoomModal({ ...roomModal, electric_rate: Number(e.target.value) })}
                    className="w-1/2 border border-slate-300 rounded-xl px-2.5 py-2 text-sm"
                    placeholder="ไฟ"
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">ชื่อผู้เช่าปัจจุบัน (ว่างได้)</label>
                <input
                  value={roomModal.tenant_name}
                  onChange={(e) => setRoomModal({ ...roomModal, tenant_name: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setRoomModal(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-xs cursor-pointer">
                ยกเลิก
              </button>
              <button type="submit" disabled={savingRoom} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-extrabold text-xs shadow cursor-pointer">
                {savingRoom ? 'กำลังบันทึก...' : 'บันทึกห้องพัก'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TENANT PROFILE MODAL (with optional ID card & house reg images) */}
      {tenantModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={saveTenantForm} className="bg-white w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">
                {tenantModal.id ? `แฟ้มประวัติผู้เช่า — ${tenantModal.name}` : 'ลงทะเบียนประวัติลูกค้าใหม่'}
              </h3>
              <button type="button" onClick={() => setTenantModal(null)} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">ชื่อ-นามสกุลผู้เช่า *</label>
                <input required value={tenantModal.name} onChange={(e) => setTenantModal({ ...tenantModal, name: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-bold" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">ห้องพัก</label>
                <select
                  value={tenantModal.room_number}
                  onChange={(e) => {
                    const rm = rooms.find((r) => r.room_number === e.target.value);
                    setTenantModal({ ...tenantModal, room_number: e.target.value, room_id: rm?.id || null });
                  }}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white"
                >
                  <option value="">-- เลือกห้องพัก --</option>
                  {rooms.map((r) => <option key={r.id} value={r.room_number}>ห้อง {r.room_number} ({r.zone})</option>)}
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">เบอร์โทรศัพท์</label>
                <input value={tenantModal.phone || ''} onChange={(e) => setTenantModal({ ...tenantModal, phone: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">เงินมัดจำ (บาท)</label>
                <input type="number" value={tenantModal.deposit_amount ?? 2500} onChange={(e) => setTenantModal({ ...tenantModal, deposit_amount: Number(e.target.value) })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">อัปโหลดสำเนาบัตรประชาชน (ไม่บังคับ)</label>
                <input type="file" accept="image/*" onChange={(e) => handleUploadTenantFile(e, 'id_card_image_url')} className="w-full text-xs" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">อัปโหลดสำเนาทะเบียนบ้าน (ไม่บังคับ)</label>
                <input type="file" accept="image/*" onChange={(e) => handleUploadTenantFile(e, 'house_reg_image_url')} className="w-full text-xs" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setTenantModal(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-xs cursor-pointer">
                ยกเลิก
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs shadow cursor-pointer">
                บันทึกข้อมูลผู้เช่า
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TRANSFER MODAL */}
      {transferModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <form onSubmit={submitTransfer} className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              ย้ายห้อง / แจ้งย้ายออก — {transferModal.tenant.name}
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">ประเภทรายการ</label>
                <select
                  value={transferModal.event_type}
                  onChange={(e) => setTransferModal({ ...transferModal, event_type: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-bold"
                >
                  <option value="room_transfer">ย้ายห้องพัก (เปลี่ยนห้อง)</option>
                  <option value="move_out">แจ้งย้ายออกจากหอพัก</option>
                </select>
              </div>
              {transferModal.event_type === 'room_transfer' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">ย้ายไปห้องใหม่</label>
                  <select
                    value={transferModal.new_room_number}
                    onChange={(e) => setTransferModal({ ...transferModal, new_room_number: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-white font-bold"
                  >
                    {rooms.map((r) => <option key={r.id} value={r.room_number}>ห้อง {r.room_number} ({r.zone})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="font-bold text-slate-700 block mb-1">วันที่ดำเนินการ</label>
                <input type="date" value={transferModal.event_date} onChange={(e) => setTransferModal({ ...transferModal, event_date: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">หมายเหตุ</label>
                <input value={transferModal.notes} onChange={(e) => setTransferModal({ ...transferModal, notes: e.target.value })} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTransferModal(null)} className="px-4 py-2 rounded-xl bg-slate-100 font-bold text-xs cursor-pointer">ยกเลิก</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-extrabold text-xs cursor-pointer">ยืนยันรายการ</button>
            </div>
          </form>
        </div>
      )}

      {/* LIGHTBOX FOR TENANT ID/HOUSE DOCS */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <div className="bg-white rounded-3xl p-4 max-w-2xl w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-slate-900">{lightboxImg.title}</span>
              <button onClick={() => setLightboxImg(null)} className="p-1.5 rounded-lg bg-slate-100 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <img src={lightboxImg.url} alt={lightboxImg.title} className="w-full max-h-[75vh] object-contain rounded-xl border border-slate-200" />
          </div>
        </div>
      )}
    </div>
  );
}
