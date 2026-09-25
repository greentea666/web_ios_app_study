import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, ChevronDown, LayoutDashboard, Menu, Plus, Settings, Trash2, Users, WalletCards, X } from "lucide-react";
import type { Appointment, Dashboard } from "@bookwise/shared";
import "./styles.css";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const demoData: Dashboard = { businessName: "光嶼顧問工作室", todayAppointments: 3, monthlyRevenue: 128400, occupancyRate: 78, appointments: [
  { id: "apt_001", customerName: "林怡君", service: "初次諮詢", startsAt: "2026-09-25T10:00:00+08:00", durationMinutes: 60, status: "confirmed" },
  { id: "apt_002", customerName: "陳柏翰", service: "品牌策略工作坊", startsAt: "2026-09-25T13:30:00+08:00", durationMinutes: 90, status: "pending" },
  { id: "apt_003", customerName: "王思妤", service: "回訪會議", startsAt: "2026-09-25T15:30:00+08:00", durationMinutes: 45, status: "confirmed" },
] };
const time = (value: string) => new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const money = (value: number) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
const defaultDate = () => new Date(Date.now() + 86400000).toISOString().slice(0, 16);

type CreatePayload = { customerName: string; service: string; startsAt: string; durationMinutes: number };

function App() {
  const [dashboard, setDashboard] = useState<Dashboard>(demoData);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      const response = await fetch(`${apiUrl}/v1/dashboard`);
      if (!response.ok) throw new Error("無法取得儀表板資料");
      const result = await response.json() as { data: Dashboard };
      setDashboard(result.data);
      setError("");
    } catch { setError("目前顯示示範資料，請確認 API 服務是否已啟動。"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadDashboard(); }, []);

  const createAppointment = async (payload: CreatePayload) => {
    const response = await fetch(`${apiUrl}/v1/appointments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error("新增預約失敗，請檢查輸入內容。");
    await loadDashboard();
    setFormOpen(false);
  };
  const updateStatus = async (appointment: Appointment) => {
    const status = appointment.status === "confirmed" ? "pending" : "confirmed";
    const response = await fetch(`${apiUrl}/v1/appointments/${appointment.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) throw new Error("更新狀態失敗");
    await loadDashboard();
  };
  const removeAppointment = async (appointment: Appointment) => {
    if (!window.confirm(`確定要刪除 ${appointment.customerName} 的預約嗎？`)) return;
    const response = await fetch(`${apiUrl}/v1/appointments/${appointment.id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("刪除預約失敗");
    await loadDashboard();
  };
  const runAction = async (action: () => Promise<void>) => { try { setError(""); await action(); } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "操作失敗"); } };

  return <div className="app-shell">
    <aside className={menuOpen ? "sidebar open" : "sidebar"}>
      <div className="brand"><span className="brand-mark">B</span><span>bookwise</span></div>
      <div className="workspace"><span className="avatar">光</span><span><strong>{dashboard.businessName}</strong><small>專業版工作區</small></span><ChevronDown size={16} /></div>
      <nav><a className="active"><LayoutDashboard size={18} />總覽</a><a><CalendarDays size={18} />預約行程</a><a><Users size={18} />客戶管理</a><a><WalletCards size={18} />營收分析</a></nav>
      <div className="sidebar-bottom"><a><Settings size={18} />工作區設定</a><div className="upgrade"><span>方案使用狀態</span><strong>專業版 · 12 天後續費</strong><div className="progress"><i /></div></div></div>
    </aside>
    <main className="main"><header><button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="開啟選單"><Menu size={20} /></button><div><p className="eyebrow">星期五，2026 年 9 月 25 日</p><h1>早安，光嶼團隊 <span>✦</span></h1></div><div className="header-actions"><button className="notification" aria-label="通知">●</button><div className="profile"><span className="avatar dark">L</span><span>Lee Chen</span><ChevronDown size={15} /></div></div></header>
      {error && <div className="alert" role="alert">{error}</div>}
      <section className="hero"><div><span className="tag">今日工作台</span><h2>把重要的會面，<br /><em>留給重要的人。</em></h2><p>所有預約、客戶與成長數據，都在這裡清楚掌握。</p></div><button className="primary" onClick={() => setFormOpen(true)}><Plus size={18} />新增預約</button></section>
      <section className="metrics"><Metric label="今日預約" value={String(dashboard.todayAppointments).padStart(2, "0")} detail="較上週同期 +2" positive /><Metric label="本月營收" value={money(dashboard.monthlyRevenue)} detail="較上月 +12.8%" positive /><Metric label="時段使用率" value={`${dashboard.occupancyRate}%`} detail="還有 4 個可用時段" /></section>
      <section className="content-grid"><div className="panel schedule"><div className="panel-heading"><div><span className="section-label">NEXT UP</span><h3>今日行程</h3></div><button className="text-button">查看全部 <span>→</span></button></div><div className="date-strip"><strong>25 <small>週五</small></strong><span>26 <small>週六</small></span><span>27 <small>週日</small></span><span>28 <small>週一</small></span><span>29 <small>週二</small></span></div><div className="appointments">{loading ? <p className="empty-state">正在載入行程...</p> : dashboard.appointments.length ? dashboard.appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} onStatus={() => void runAction(() => updateStatus(appointment))} onDelete={() => void runAction(() => removeAppointment(appointment))} />) : <p className="empty-state">今天還沒有預約，建立第一筆行程吧。</p>}</div></div><div className="panel insight"><div className="panel-heading"><div><span className="section-label">PULSE</span><h3>營運脈動</h3></div><button className="icon-button" aria-label="更多分析">···</button></div><div className="chart"><div className="chart-value">78%<small>本月平均使用率</small></div><div className="bars">{[38, 52, 45, 64, 58, 76, 66, 83, 72, 92, 79, 88].map((height, index) => <i key={index} style={{ height: `${height}%` }} className={index === 9 ? "selected" : ""} />)}</div><div className="chart-labels"><span>09/01</span><span>09/15</span><span>09/30</span></div></div><div className="insight-note"><span>↗</span><p><strong>表現得很好。</strong> 你這個月的回訪率比上個月高出 18%。</p></div></div></section>
    </main>
    {formOpen && <AppointmentForm onClose={() => setFormOpen(false)} onSubmit={(payload) => runAction(() => createAppointment(payload))} />}
  </div>;
}

function AppointmentForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (payload: CreatePayload) => Promise<void> }) {
  const [customerName, setCustomerName] = useState(""); const [service, setService] = useState(""); const [startsAt, setStartsAt] = useState(defaultDate); const [durationMinutes, setDurationMinutes] = useState("60"); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!customerName.trim() || !service.trim()) { setError("請填寫客戶姓名與服務名稱。"); return; } setSubmitting(true); setError(""); try { await onSubmit({ customerName, service, startsAt: new Date(startsAt).toISOString(), durationMinutes: Number(durationMinutes) }); } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "新增失敗"); } finally { setSubmitting(false); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="modal" onSubmit={(event) => void submit(event)}><div className="modal-header"><div><span className="section-label">NEW BOOKING</span><h3>新增預約</h3></div><button type="button" className="icon-button" onClick={onClose} aria-label="關閉"><X size={18} /></button></div>{error && <div className="form-error">{error}</div>}<label>客戶姓名<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="例如：林怡君" autoFocus /></label><label>服務內容<input value={service} onChange={(event) => setService(event.target.value)} placeholder="例如：初次諮詢" /></label><div className="form-row"><label>開始時間<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label><label>時長<select value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)}><option value="30">30 分鐘</option><option value="60">60 分鐘</option><option value="90">90 分鐘</option><option value="120">120 分鐘</option></select></label></div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button type="submit" className="primary" disabled={submitting}>{submitting ? "建立中..." : <><Plus size={17} />建立預約</>}</button></div></form></div>;
}
function Metric({ label, value, detail, positive }: { label: string; value: string; detail: string; positive?: boolean }) { return <article className="metric"><span>{label}</span><strong>{value}</strong><small className={positive ? "positive" : ""}>{positive && "↗ "}{detail}</small></article>; }
function AppointmentRow({ appointment, onStatus, onDelete }: { appointment: Appointment; onStatus: () => void; onDelete: () => void }) { return <div className="appointment"><div className="appointment-time"><strong>{time(appointment.startsAt)}</strong><span>{appointment.durationMinutes} min</span></div><div className="appointment-line" /><div className="appointment-detail"><span className="customer-avatar">{appointment.customerName.slice(0, 1)}</span><div><strong>{appointment.customerName}</strong><span>{appointment.service}</span></div></div><button className={`status ${appointment.status}`} onClick={onStatus}>{appointment.status === "confirmed" ? "已確認" : "待確認"}</button><button className="more delete-button" onClick={onDelete} aria-label={`刪除 ${appointment.customerName} 預約`}><Trash2 size={15} /></button></div>; }

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
