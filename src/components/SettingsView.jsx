import React, { useState, useEffect } from 'react';
import { Save, Upload, Building2, CreditCard } from 'lucide-react';

export default function SettingsView({ settings = {}, zones = [], onSaved, onGoToZones, showToast }) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const onUploadQrCode = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, qr_code_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('บันทึกการตั้งค่าไม่สำเร็จ');
      if (showToast) showToast(`บันทึกข้อมูล "${form.dorm_name}" และ QR Code ลง Supabase เรียบร้อย!`);
      if (onSaved) await onSaved();
    } catch (err) {
      if (showToast) showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-4xl mx-auto bg-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-200 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
            <Building2 className="w-3.5 h-3.5" />
            <span>ตั้งค่าหอพักอิ่มสุข &amp; ข้อมูลการโอนเงิน</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1">
            แก้ไขชื่อหอพัก • รายละเอียดบัญชีรับโอน &amp; QR Code
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            ข้อมูลทั้งหมดจะอัปเดตบนหัวใบเสร็จรับเงิน รายงาน A4 และไฟล์ PDF ทันทีที่บันทึก
          </p>
        </div>

        {onGoToZones && (
          <button
            type="button"
            onClick={onGoToZones}
            className="bg-amber-100 hover:bg-amber-200 text-amber-900 px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer self-start sm:self-auto"
          >
            🗺️ แบ่งโซนหอพัก ({zones.length} โซน)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อหอพัก (ค่าเริ่มต้น: หอพักอิ่มสุข)</label>
            <input
              value={form.dorm_name || ''}
              onChange={(e) => setForm({ ...form, dorm_name: e.target.value })}
              className="w-full border-2 border-emerald-400 rounded-xl px-3.5 py-2.5 text-base font-extrabold text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="หอพักอิ่มสุข"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">หัวกระดาษใบเสร็จรับเงิน</label>
            <input
              value={form.receipt_title || ''}
              onChange={(e) => setForm({ ...form, receipt_title: e.target.value })}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ธนาคารรับโอน</label>
              <input
                value={form.bank_name || ''}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">เลขที่บัญชี</label>
              <input
                value={form.account_number || ''}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อเจ้าของบัญชี</label>
            <input
              value={form.account_holder || ''}
              onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ข้อความในกรอบใต้รูป QR Code</label>
            <input
              value={form.qr_caption || ''}
              onChange={(e) => setForm({ ...form, qr_caption: e.target.value })}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">เรทน้ำ (บ./หน่วย)</label>
              <input type="number" value={form.default_water_rate ?? 10} onChange={(e) => setForm({ ...form, default_water_rate: Number(e.target.value) })} className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-sm font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">น้ำเหมา (บ./คน)</label>
              <input type="number" value={form.default_water_per_person ?? 100} onChange={(e) => setForm({ ...form, default_water_per_person: Number(e.target.value) })} className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-sm font-bold" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">เรทไฟ (บ./หน่วย)</label>
              <input type="number" value={form.default_electric_rate ?? 8} onChange={(e) => setForm({ ...form, default_electric_rate: Number(e.target.value) })} className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-sm font-bold" />
            </div>
          </div>
        </div>

        {/* QR Upload & Footer Preview */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center text-center">
            <span className="text-xs font-bold text-slate-600 mb-3 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>รูปภาพ QR Code รับโอนเงิน</span>
            </span>
            <div className="w-40 h-40 bg-white border border-slate-300 rounded-2xl p-2 flex items-center justify-center shadow-xs mb-3">
              {form.qr_code_url ? (
                <img src={form.qr_code_url} alt="QR" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400">ยังไม่มีรูป QR Code</span>
              )}
            </div>
            <label className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>อัปโหลดรูป QR Code ใหม่</span>
              <input type="file" accept="image/*" onChange={onUploadQrCode} className="hidden" />
            </label>
          </div>

          <div className="p-4 rounded-2xl border border-slate-300 bg-white">
            <div className="text-[11px] text-slate-400 font-semibold mb-2">ตัวอย่างส่วนท้ายใบเสร็จ ({form.dorm_name || 'หอพักอิ่มสุข'}):</div>
            <div className="flex justify-between items-start text-sm font-bold text-black">
              <div>
                <div>โอนเลขบัญชี : {form.bank_name} {form.account_number}</div>
                <div className="pl-20 mt-1">{form.account_holder}</div>
              </div>
              <div className="flex flex-col items-center">
                {form.qr_code_url && <img src={form.qr_code_url} alt="QR" className="w-16 h-16 object-contain" />}
                <div className="border border-black px-2 py-0.5 text-[11px] mt-1">
                  {form.qr_caption || form.account_holder}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200">
        <button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-6 py-2.5 rounded-xl text-sm shadow cursor-pointer flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมดลง Supabase'}</span>
        </button>
      </div>
    </form>
  );
}
