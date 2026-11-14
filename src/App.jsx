import React, { useState, useEffect, useCallback } from 'react';
import {
  Home, FileSpreadsheet, Receipt, MapPin, Wallet, BarChart3, Bot, Settings, Menu, X, CheckCircle2, AlertCircle
} from 'lucide-react';
import MonthlyRoomIconsView from './components/MonthlyRoomIconsView.jsx';
import MonthlyReportAndPdfView from './components/MonthlyReportAndPdfView.jsx';
import DailyCustomReceiptView from './components/DailyCustomReceiptView.jsx';
import RoomsZonesTenantsView from './components/RoomsZonesTenantsView.jsx';
import AccountingAndReportsView from './components/AccountingAndReportsView.jsx';
import DashboardInfographicView from './components/DashboardInfographicView.jsx';
import BillAuditLogsView from './components/BillAuditLogsView.jsx';
import SettingsView from './components/SettingsView.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('notebook');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roomsSubTabDefault, setRoomsSubTabDefault] = useState('zones');

  // Shared Billing Period State
  const [billingMonth, setBillingMonth] = useState('ธันวาคม');
  const [billingYearBe, setBillingYearBe] = useState(2569);

  // Dashboard / Accounting Period State (defaults to พฤศจิกายน 2569 where rich baseline bills exist, synced cleanly)
  const [dashMonth, setDashMonth] = useState('พฤศจิกายน');
  const [dashYearBe, setDashYearBe] = useState(2569);

  // Shared App Data from Node.js + Supabase
  const [settings, setSettings] = useState({ dorm_name: 'หอพักอิ่มสุข', receipt_title: 'ใบเสร็จรับเงินค่าเช่าห้อง' });
  const [zones, setZones] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [accountingList, setAccountingList] = useState([]);

  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3800);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch('/api/settings');
    if (res.ok) setSettings(await res.json());
  }, []);

  const loadZones = useCallback(async () => {
    const res = await fetch('/api/zones');
    if (res.ok) setZones(await res.json());
  }, []);

  const loadRooms = useCallback(async () => {
    const res = await fetch('/api/rooms');
    if (res.ok) setRooms(await res.json());
  }, []);

  const loadTenants = useCallback(async () => {
    const res = await fetch('/api/tenants');
    if (res.ok) setTenants(await res.json());
  }, []);

  const loadDashboardAndAccounting = useCallback(async () => {
    const [dRes, aRes] = await Promise.all([
      fetch(`/api/dashboard?month=${encodeURIComponent(dashMonth)}&year_be=${dashYearBe}`),
      fetch(`/api/accounting?billing_month=${encodeURIComponent(dashMonth)}&billing_year_be=${dashYearBe}`)
    ]);
    if (dRes.ok) setDashboard(await dRes.json());
    if (aRes.ok) setAccountingList(await aRes.json());
  }, [dashMonth, dashYearBe]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadSettings(),
      loadZones(),
      loadRooms(),
      loadTenants(),
      loadDashboardAndAccounting()
    ]);
  }, [loadSettings, loadZones, loadRooms, loadTenants, loadDashboardAndAccounting]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const tabs = [
    {
      id: 'notebook',
      label: 'จดบิลไอคอนห้อง',
      short: 'จดบิล',
      icon: Home,
      gradient: 'from-[#0066EE] to-indigo-600',
      iconBg: 'bg-blue-100 text-[#0066EE]',
      desc: 'กรอกมิเตอร์รายเดือน'
    },
    {
      id: 'monthly_report',
      label: 'รีพอร์ต A4 & PDF',
      short: 'รีพอร์ต/PDF',
      icon: FileSpreadsheet,
      gradient: 'from-violet-600 to-purple-600',
      iconBg: 'bg-violet-100 text-violet-600',
      desc: 'สรุปตาราง & ครึ่ง A4'
    },
    {
      id: 'daily',
      label: 'รายวัน / ฟอร์มเปล่า',
      short: 'รายวัน',
      icon: Receipt,
      gradient: 'from-sky-500 to-cyan-600',
      iconBg: 'bg-sky-100 text-sky-600',
      desc: 'บิลรายวัน & กำหนดเอง'
    },
    {
      id: 'zones_rooms',
      label: 'โซน & ห้องพัก/ผู้เช่า',
      short: 'โซน/ห้อง',
      icon: MapPin,
      gradient: 'from-amber-500 to-orange-500',
      iconBg: 'bg-amber-100 text-amber-600',
      desc: 'จัดการโซน & ประวัติ'
    },
    {
      id: 'dashboard',
      label: 'แดชบอร์ดผู้บริหาร A4',
      short: 'แดชบอร์ด',
      icon: BarChart3,
      gradient: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-100 text-emerald-600',
      desc: 'อินโฟกราฟิกรายเดือน'
    },
    {
      id: 'accounting',
      label: 'บัญชีรายรับ-รายจ่าย',
      short: 'บัญชี',
      icon: Wallet,
      gradient: 'from-rose-500 to-pink-600',
      iconBg: 'bg-rose-100 text-rose-600',
      desc: 'ซ่อมบำรุง & งบกำไร'
    },
    {
      id: 'logs',
      label: 'ล็อกเอเจนต์ & ประวัติ',
      short: 'ล็อกบิล',
      icon: Bot,
      gradient: 'from-indigo-600 to-blue-700',
      iconBg: 'bg-indigo-100 text-indigo-600',
      desc: 'สมการบิลรายห้อง'
    },
    {
      id: 'settings',
      label: 'ตั้งค่าหอพัก & QR',
      short: 'ตั้งค่า',
      icon: Settings,
      gradient: 'from-teal-500 to-emerald-600',
      iconBg: 'bg-teal-100 text-teal-600',
      desc: 'ชื่อหอพัก & บัญชีโอน'
    }
  ];

  const activeTabMeta = tabs.find((t) => t.id === activeTab) || tabs[0];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F3F6FC] text-slate-900 pb-24 lg:pb-8 flex">
      {/* Desktop Colorful Left Sidebar Navigation */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-72 shrink-0 sticky top-0 h-screen bg-white border-r border-slate-200/80 shadow-[6px_0_32px_-12px_rgba(37,99,235,0.12)] z-40">
        {/* Sidebar Brand Card */}
        <div className="p-4 border-b border-slate-100">
          <div
            onClick={() => handleSelectTab('notebook')}
            className="rounded-3xl bg-gradient-to-br from-[#0066EE] via-indigo-600 to-violet-600 p-4 text-white shadow-lg shadow-blue-500/25 cursor-pointer transition hover:scale-[1.01]"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0">
                <Home className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-extrabold tracking-tight truncate">
                  {settings?.dorm_name || 'หอพักอิ่มสุข'}
                </div>
                <div className="text-[11px] text-blue-100 font-semibold mt-0.5">
                  {zones.length} โซน • {rooms.length} ห้องพัก
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between text-[11px] text-blue-50">
              <span>Smart Dormitory</span>
              <span className="px-2 py-0.5 rounded-full bg-white/20 font-bold">Supabase Sync</span>
            </div>
          </div>
        </div>

        {/* Sidebar Menu Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 custom-scrollbar">
          <div className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            เมนูหลักระบบหอพัก
          </div>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`w-full px-3 py-2.5 rounded-2xl text-left cursor-pointer flex items-center gap-3 transition-all duration-200 ${
                  active
                    ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md shadow-blue-500/15 scale-[1.01]`
                    : 'text-slate-700 hover:bg-slate-100/90'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                    active ? 'bg-white/20 text-white' : tab.iconBg
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold truncate">{tab.label}</div>
                  <div className={`text-[10px] truncate ${active ? 'text-white/80' : 'text-slate-400'}`}>
                    {tab.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Period & Quick Settings */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/70 space-y-2">
          <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/70 px-3 py-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-semibold">งวดจดมิเตอร์</span>
            <strong className="text-[#0066EE] font-extrabold">{billingMonth} {billingYearBe}</strong>
          </div>
          <button
            onClick={() => handleSelectTab('settings')}
            className="w-full bg-white hover:bg-blue-50 text-slate-800 border border-slate-200 font-extrabold px-3 py-2 rounded-2xl text-xs cursor-pointer transition flex items-center justify-center gap-1.5 shadow-xs"
          >
            <span>✏️ แก้ไขชื่อหอพัก / QR</span>
          </button>
        </div>
      </aside>

      {/* Right Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Bright Top Header (Mobile Brand + Desktop Context Bar) */}
        <header className="no-print sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
            {/* Mobile Brand */}
            <div
              onClick={() => handleSelectTab('notebook')}
              className="flex lg:hidden items-center gap-2.5 cursor-pointer min-w-0"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0066EE] to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
                <Home className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-black text-[#0066EE] tracking-tight truncate">
                  {settings?.dorm_name || 'หอพักอิ่มสุข'}
                </div>
                <div className="text-[11px] font-bold text-slate-500 truncate">
                  {zones.length} โซน • {rooms.length} ห้อง • {billingMonth} {billingYearBe}
                </div>
              </div>
            </div>

            {/* Desktop Current Section Title */}
            <div className="hidden lg:flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${activeTabMeta.gradient} text-white flex items-center justify-center shadow-sm shrink-0`}>
                <activeTabMeta.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-slate-900 truncate">{activeTabMeta.label}</h1>
                <p className="text-xs text-slate-500 truncate">{activeTabMeta.desc} • {settings?.dorm_name || 'หอพักอิ่มสุข'}</p>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-[#0066EE] border border-blue-200 text-xs font-extrabold">
                งวด: {billingMonth} {billingYearBe}
              </span>
              <button
                onClick={() => handleSelectTab('settings')}
                className="hidden sm:inline-flex lg:hidden bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-full text-xs cursor-pointer"
              >
                ตั้งค่า/QR
              </button>
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden p-2.5 rounded-2xl bg-blue-50 border border-blue-200 text-[#0066EE] cursor-pointer"
                aria-label="เมนูทั้งหมด"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Slide-Down Colorful Menu Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden bg-white border-t border-slate-200 px-3 py-3 grid grid-cols-2 gap-2 shadow-xl">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleSelectTab(tab.id)}
                    className={`px-3 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer text-left transition ${
                      active
                        ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md`
                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-white/20 text-white' : tab.iconBg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        {/* Main Content Container */}
        <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
        {activeTab === 'notebook' && (
          <MonthlyRoomIconsView
            settings={settings}
            zones={zones}
            billingMonth={billingMonth}
            setBillingMonth={setBillingMonth}
            billingYearBe={billingYearBe}
            setBillingYearBe={setBillingYearBe}
            onSyncSuccess={refreshAll}
            onGoToZones={() => {
              setRoomsSubTabDefault('zones');
              handleSelectTab('zones_rooms');
            }}
            onGoToReportPdf={() => handleSelectTab('monthly_report')}
            showToast={showToast}
          />
        )}

        {activeTab === 'monthly_report' && (
          <MonthlyReportAndPdfView
            settings={settings}
            zones={zones}
            billingMonth={billingMonth}
            setBillingMonth={setBillingMonth}
            billingYearBe={billingYearBe}
            setBillingYearBe={setBillingYearBe}
            showToast={showToast}
          />
        )}

        {activeTab === 'daily' && (
          <DailyCustomReceiptView
            rooms={rooms}
            settings={settings}
            onSaved={refreshAll}
            showToast={showToast}
          />
        )}

        {activeTab === 'zones_rooms' && (
          <RoomsZonesTenantsView
            rooms={rooms}
            zones={zones}
            tenants={tenants}
            initialSubTab={roomsSubTabDefault}
            onRefreshAll={refreshAll}
            showToast={showToast}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardInfographicView
            dashboard={dashboard}
            settings={settings}
            dashMonth={dashMonth}
            setDashMonth={setDashMonth}
            dashYearBe={dashYearBe}
            setDashYearBe={setDashYearBe}
            showToast={showToast}
          />
        )}

        {activeTab === 'accounting' && (
          <AccountingAndReportsView
            dashboard={dashboard}
            accountingList={accountingList}
            rooms={rooms}
            settings={settings}
            dashMonth={dashMonth}
            setDashMonth={setDashMonth}
            dashYearBe={dashYearBe}
            setDashYearBe={setDashYearBe}
            onRefresh={loadDashboardAndAccounting}
            showToast={showToast}
          />
        )}

        {activeTab === 'logs' && (
          <BillAuditLogsView
            billingMonth={billingMonth}
            billingYearBe={billingYearBe}
            showToast={showToast}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            zones={zones}
            onSaved={loadSettings}
            onGoToZones={() => {
              setRoomsSubTabDefault('zones');
              handleSelectTab('zones_rooms');
            }}
            showToast={showToast}
          />
        )}
        </main>
      </div>

      {/* Mobile Curved Electric-Blue Bottom Navigation Dock (Inspired by Reference App) */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-[#0066EE] via-[#1D6FF2] to-[#3B82F6] text-white rounded-t-[26px] px-2 py-2 flex items-center justify-around shadow-[0_-8px_30px_rgba(0,102,238,0.28)]">
        {[tabs[0], tabs[1], tabs[3], tabs[4], tabs[7]].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-2xl min-w-[60px] cursor-pointer transition ${
                active ? 'bg-white text-[#0066EE] font-extrabold shadow-md' : 'text-blue-100 hover:text-white font-semibold'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{tab.short}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`no-print fixed bottom-20 lg:bottom-6 right-4 z-50 max-w-sm px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-bottom-3 ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500'
              : 'bg-slate-900 text-white border-emerald-500/50'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-rose-200 shrink-0" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
