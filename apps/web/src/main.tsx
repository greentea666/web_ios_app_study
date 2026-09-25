import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CalendarDays, ChevronDown, Clock3, LayoutDashboard, Menu, Plus, Settings, Users, WalletCards } from "lucide-react";
import type { Appointment, Dashboard } from "@bookwise/shared";
import "./styles.css";

const demoData: Dashboard = { businessName: "光嶼顧問工作室", todayAppointments: 3, monthlyRevenue: 128400, occupancyRate: 78, appointments: [
  { id: "apt_001", customerName: "林怡君", service: "初次諮詢", startsAt: "2026-09-25T10:00:00+08:00", durationMinutes: 60, status: "confirmed" },
  { id: "apt_002", customerName: "陳柏翰", service: "品牌策略工作坊", startsAt: "2026-09-25T13:30:00+08:00", durationMinutes: 90, status: "pending" },
  { id: "apt_003", customerName: "王思妤", service: "回訪會議", startsAt: "2026-09-25T15:30:00+08:00", durationMinutes: 45, status: "confirmed" },
] };

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const time = (value: string) => new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const money = (value: number) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);

function App() {
  const [dashboard, setDashboard] = useState<Dashboard>(demoData);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { fetch(`${apiUrl}/v1/dashboard`).then((response) => response.json()).then((result) => setDashboard(result.data)).catch(() => undefined); }, []);
  return <div className="app-shell">
    <aside className={menuOpen ? "sidebar open" : "sidebar"}>
      <div className="brand"><span className="brand-mark">B</span><span>bookwise</span></div>
      <div className="workspace"><span className="avatar">光</span><span><strong>{dashboard.businessName}</strong><small>專業版工作區</small></span><ChevronDown size={16} /></div>
      <nav><a className="active"><LayoutDashboard size={18} />總覽</a><a><CalendarDays size={18} />預約行程</a><a><Users size={18} />客戶管理</a><a><WalletCards size={18} />營收分析</a></nav>
      <div className="sidebar-bottom"><a><Settings size={18} />工作區設定</a><div className="upgrade"><span>方案使用狀態</span><strong>專業版 · 12 天後續費</strong><div className="progress"><i /></div></div></div>
    </aside>
    <main className="main"><header><button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="開啟選單"><Menu size={20} /></button><div><p className="eyebrow">星期五，2026 年 9 月 25 日</p><h1>早安，光嶼團隊 <span>✦</span></h1></div><div className="header-actions"><button className="notification" aria-label="通知">●</button><div className="profile"><span className="avatar dark">L</span><span>Lee Chen</span><ChevronDown size={15} /></div></div></header>
      <section className="hero"><div><span className="tag">今日工作台</span><h2>把重要的會面，<br /><em>留給重要的人。</em></h2><p>所有預約、客戶與成長數據，都在這裡清楚掌握。</p></div><button className="primary"><Plus size={18} />新增預約</button></section>
      <section className="metrics"><Metric label="今日預約" value={String(dashboard.todayAppointments).padStart(2, "0")} detail="較上週同期 +2" positive /><Metric label="本月營收" value={money(dashboard.monthlyRevenue)} detail="較上月 +12.8%" positive /><Metric label="時段使用率" value={`${dashboard.occupancyRate}%`} detail="還有 4 個可用時段" /></section>
      <section className="content-grid"><div className="panel schedule"><div className="panel-heading"><div><span className="section-label">NEXT UP</span><h3>今日行程</h3></div><button className="text-button">查看全部 <span>→</span></button></div><div className="date-strip"><strong>25 <small>週五</small></strong><span>26 <small>週六</small></span><span>27 <small>週日</small></span><span>28 <small>週一</small></span><span>29 <small>週二</small></span></div><div className="appointments">{dashboard.appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} />)}</div></div><div className="panel insight"><div className="panel-heading"><div><span className="section-label">PULSE</span><h3>營運脈動</h3></div><button className="icon-button"><span>···</span></button></div><div className="chart"><div className="chart-value">78%<small>本月平均使用率</small></div><div className="bars">{[38, 52, 45, 64, 58, 76, 66, 83, 72, 92, 79, 88].map((height, index) => <i key={index} style={{ height: `${height}%` }} className={index === 9 ? "selected" : ""} />)}</div><div className="chart-labels"><span>09/01</span><span>09/15</span><span>09/30</span></div></div><div className="insight-note"><span>↗</span><p><strong>表現得很好。</strong> 你這個月的回訪率比上個月高出 18%。</p></div></div></section>
    </main>
  </div>;
}
function Metric({ label, value, detail, positive }: { label: string; value: string; detail: string; positive?: boolean }) { return <article className="metric"><span>{label}</span><strong>{value}</strong><small className={positive ? "positive" : ""}>{positive && "↗ "}{detail}</small></article>; }
function AppointmentRow({ appointment }: { appointment: Appointment }) { return <div className="appointment"><div className="appointment-time"><strong>{time(appointment.startsAt)}</strong><span>{appointment.durationMinutes} min</span></div><div className="appointment-line" /><div className="appointment-detail"><span className="customer-avatar">{appointment.customerName.slice(0, 1)}</span><div><strong>{appointment.customerName}</strong><span>{appointment.service}</span></div></div><span className={`status ${appointment.status}`}>{appointment.status === "confirmed" ? "已確認" : "待確認"}</span><button className="more" aria-label="更多選項">···</button></div>; }
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);