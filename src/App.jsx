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
    { id: 'notebook', label: 'จดบิลไอคอนห้อง', short: 'จดบิล', icon: Home },
    { id: 'monthly_report', label: 'รีพอร์ต A4 & PDF', short: 'รีพอร์ต/PDF', icon: FileSpreadsheet },
    { id: 'daily', label: 'รายวัน / ฟอร์มเปล่า', short: 'รายวัน', icon: Receipt },
    { id: 'zones_rooms', label: 'โซน & ห้องพัก/ผู้เช่า', short: 'โซน/ห้อง', icon: MapPin },
    { id: 'dashboard', label: 'แดชบอร์ดผู้บริหาร A4', short: 'แดชบอร์ด', icon: BarChart3 },
    { id: 'accounting', label: 'บัญชีรายรับ-รายจ่าย', short: 'บัญชี', icon: Wallet },
    { id: 'logs', label: 'ล็อกเอเจนต์ & ประวัติ', short: 'ล็อกบิล', icon: Bot },
    { id: 'settings', label: 'ตั้งค่าหอพัก & QR', short: 'ตั้งค่า', icon: Settings }
  ];

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 pb-24 lg:pb-10">
      {/* Top Sticky Glass Header */}
      <header className="no-print sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md text-white border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo & Dorm Name */}
          <div
            onClick={() => handleSelectTab('notebook')}
            className="flex items-center gap-3 cursor-pointer min-w-0"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 font-black shadow-md shrink-0">
              <Home className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-extrabold tracking-tight truncate">
                  {settings?.dorm_name || 'หอพักอิ่มสุข'}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  {zones.length} โซน • {rooms.length} ห้อง
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Smart Dormitory Billing • React + Node.js + Supabase
              </div>
            </div>
          </div>

          {/* Mobile Drawer Trigger */}
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
            aria-label="เมนูทั้งหมด"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Desktop Quick Settings / Period Pill */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <span className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl text-slate-300">
              งวดจดมิเตอร์: <strong className="text-emerald-400">{billingMonth} {billingYearBe}</strong>
            </span>
            <button
              onClick={() => handleSelectTab('settings')}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-xl cursor-pointer transition"
            >
              ✏️ แก้ไขชื่อหอพัก / QR
            </button>
          </div>
        </div>

        {/* Desktop Sub-Navigation Pills */}
        <nav className="hidden lg:block bg-slate-950/60 border-t border-slate-800/80">
          <div className="max-w-7xl mx-auto px-6 py-2 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center gap-1.5 transition ${
                    active
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Mobile Slide-Down Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-slate-900 border-t border-slate-800 px-3 py-3 grid grid-cols-2 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer text-left ${
                    active ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800/70 text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
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

      {/* Mobile Bottom Navigation Dock (Smart Device Friendly) */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {[tabs[0], tabs[1], tabs[3], tabs[6], tabs[7]].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl min-w-[58px] cursor-pointer transition ${
                active ? 'text-emerald-700 bg-emerald-50 font-extrabold' : 'text-slate-500 font-semibold'
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
