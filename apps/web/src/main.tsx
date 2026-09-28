import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, CalendarDays, Check, ChevronDown, CircleAlert, Clock3, LayoutDashboard, Menu, Pencil, Plus, Search, Settings, Trash2, Users, WalletCards, X } from "lucide-react";
import type { Appointment, Customer, Dashboard, Service, Workspace } from "@bookwise/shared";
import "./styles.css";

const apiUrl = (import.meta.env.VITE_API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");
type Page = "dashboard" | "appointments" | "customers" | "services" | "reports" | "settings";
const navigation: { id: Page; label: string; icon: typeof LayoutDashboard; feature: string }[] = [
  { id: "dashboard", label: "總覽", icon: LayoutDashboard, feature: "dashboard" },
  { id: "appointments", label: "預約管理", icon: CalendarDays, feature: "appointments" },
  { id: "customers", label: "客戶資料", icon: Users, feature: "customers" },
  { id: "services", label: "服務項目", icon: WalletCards, feature: "services" },
  { id: "reports", label: "營運報表", icon: BarChart3, feature: "reports" },
];
const money = (value: number, currency = "TWD") => new Intl.NumberFormat("zh-TW", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const dateTime = (value: string) => new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const dateLabel = new Intl.DateTimeFormat("zh-TW", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());
const localDateTime = (date = new Date()) => { const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return adjusted.toISOString().slice(0, 16); };
type Report = { totalAppointments: number; revenue: number; averageBookingValue: number; byService: { service: string; count: number; revenue: number }[]; byDay: { date: string; count: number; revenue: number }[] };
type ApiResult<T> = { data: T };

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("bookwise.token") ?? "");
  const [demoMode, setDemoMode] = useState(() => localStorage.getItem("bookwise.demo") === "true");
  const [workspaceId, setWorkspaceId] = useState(() => localStorage.getItem("bookwise.workspace") ?? "demo-workspace");
  const [page, setPage] = useState<Page>("dashboard");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"appointment" | "customer" | "service" | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { "content-type": "application/json", "x-workspace-id": workspaceId, ...(token ? { authorization: `Bearer ${token}` } : {}), ...init?.headers } });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { message?: string; error?: string };
      if (response.status === 401) { localStorage.removeItem("bookwise.token"); setToken(""); }
      throw new Error(body.message ?? body.error ?? "操作失敗，請稍後再試。 ");
    }
    if (response.status === 204) return undefined as T;
    const result = await response.json() as ApiResult<T>;
    return result.data;
  }, [token, workspaceId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextWorkspace, nextDashboard, nextAppointments, nextCustomers, nextServices, nextReport] = await Promise.all([
        request<Workspace>("/v1/workspace"), request<Dashboard>("/v1/dashboard"), request<Appointment[]>("/v1/appointments"),
        request<Customer[]>("/v1/customers"), request<Service[]>("/v1/services?includeInactive=true"), request<Report>("/v1/reports"),
      ]);
      setWorkspace(nextWorkspace); setDashboard(nextDashboard); setAppointments(nextAppointments); setCustomers(nextCustomers); setServices(nextServices); setReport(nextReport); setError("");
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "無法載入資料，請確認 API 服務是否正常。 "); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { if (token) void refresh(); else setLoading(false); }, [refresh, token]);
  useEffect(() => { if (workspace?.brandColor) document.documentElement.style.setProperty("--brand", workspace.brandColor); }, [workspace?.brandColor]);

  const run = async (action: () => Promise<unknown>) => { try { await action(); setError(""); await refresh(); return true; } catch (actionError) { setError(actionError instanceof Error ? actionError.message : "操作失敗"); return false; } };
  const changeWorkspace = (value: string) => {
    if (!demoMode) return;
    const id = value.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "demo-workspace";
    localStorage.setItem("bookwise.workspace", id); setWorkspaceId(id);
  };
  const acceptSession = (session: { token: string; workspaceId: string; role: string }) => {
    localStorage.setItem("bookwise.token", session.token); localStorage.setItem("bookwise.workspace", session.workspaceId);
    localStorage.setItem("bookwise.demo", String(session.role === "DEMO"));
    setToken(session.token); setWorkspaceId(session.workspaceId); setDemoMode(session.role === "DEMO");
  };
  const signOut = () => { localStorage.removeItem("bookwise.token"); localStorage.removeItem("bookwise.demo"); setToken(""); setDemoMode(false); };
  const visibleNav = navigation.filter((item) => workspace?.features[item.feature] !== false);
  const openDialog = (type: "appointment" | "customer" | "service", customer?: Customer, service?: Service, appointment?: Appointment) => {
    setEditingCustomer(customer ?? null); setEditingService(service ?? null); setEditingAppointment(appointment ?? null); setDialog(type);
  };
  const closeDialog = () => { setDialog(null); setEditingCustomer(null); setEditingService(null); setEditingAppointment(null); };

  if (!token) return <AuthScreen onSession={acceptSession} />;

  return <div className="app-shell">
    <aside className={menuOpen ? "sidebar open" : "sidebar"}>
      <div className="brand"><span className="brand-mark">B</span><span>bookwise</span><span className="brand-caption">STUDIO</span></div>
      <button className="workspace workspace-switch" onClick={() => setPage("settings")}><span className="avatar">{workspace?.name.slice(0, 1) ?? "B"}</span><span><strong>{workspace?.name ?? "載入工作區…"}</strong><small>工作區設定</small></span><ChevronDown size={16} /></button>
      <nav>{visibleNav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? "active" : ""} onClick={() => { setPage(id); setMenuOpen(false); }}><Icon size={18} />{label}</button>)}</nav>
      {workspace?.features.settings !== false && <div className="sidebar-bottom"><button className={page === "settings" ? "active" : ""} onClick={() => setPage("settings")}><Settings size={18} />工作區設定</button><div className="upgrade"><span>資料狀態</span><strong>{loading ? "同步中…" : "已連線 · 即時資料"}<i className="online-dot" /></strong><div className="progress"><i /></div></div></div>}
    </aside>
    <main className="main">
      <header className="app-header"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="開啟選單"><Menu size={20} /></button><div><p className="eyebrow">{dateLabel}</p><h1>{pageTitle(page)} <span>✦</span></h1></div><div className="header-actions"><button className="workspace-chip" onClick={() => setPage("settings")}><span className="online-dot" />{workspaceId}</button><span className="avatar dark">{workspace?.name.slice(0, 1) ?? "B"}</span><button className="signout-button" onClick={signOut}>登出</button></div></header>
      {error && <div className="alert" role="alert"><CircleAlert size={17} />{error}<button onClick={() => setError("")} aria-label="關閉通知"><X size={16} /></button></div>}
      {page === "dashboard" && dashboard && <DashboardPage dashboard={dashboard} appointments={appointments} customers={customers} services={services} currency={workspace?.currency ?? "TWD"} loading={loading} onNew={() => openDialog("appointment")} onGo={setPage} onStatus={(appointment, status) => void run(() => request(`/v1/appointments/${appointment.id}`, { method: "PATCH", body: JSON.stringify({ status }) }))} />}
      {page === "appointments" && <AppointmentsPage appointments={appointments} customers={customers} services={services} loading={loading} onNew={() => openDialog("appointment")} onEdit={(item) => openDialog("appointment", undefined, undefined, item)} onStatus={(appointment, status) => void run(() => request(`/v1/appointments/${appointment.id}`, { method: "PATCH", body: JSON.stringify({ status }) }))} onDelete={(item) => { if (window.confirm(`刪除 ${item.customerName} 的預約？`)) void run(() => request(`/v1/appointments/${item.id}`, { method: "DELETE" })); }} />}
      {page === "customers" && <CustomersPage customers={customers} appointments={appointments} loading={loading} onNew={() => openDialog("customer")} onEdit={(item) => openDialog("customer", item)} onDelete={(item) => { if (window.confirm(`刪除客戶「${item.name}」？有預約紀錄的客戶無法刪除。`)) void run(() => request(`/v1/customers/${item.id}`, { method: "DELETE" })); }} />}
      {page === "services" && <ServicesPage services={services} appointments={appointments} currency={workspace?.currency ?? "TWD"} loading={loading} onNew={() => openDialog("service")} onEdit={(item) => openDialog("service", undefined, item)} onToggle={(item) => void run(() => request(`/v1/services/${item.id}`, { method: "PATCH", body: JSON.stringify({ active: !item.active }) }))} onDelete={(item) => { if (window.confirm(`刪除服務「${item.name}」？有預約紀錄的服務無法刪除。`)) void run(() => request(`/v1/services/${item.id}`, { method: "DELETE" })); }} />}
      {page === "reports" && <ReportsPage report={report} currency={workspace?.currency ?? "TWD"} loading={loading} />}
      {page === "settings" && workspace && <SettingsPage workspace={workspace} workspaceId={workspaceId} canSwitch={demoMode} onSave={(changes) => void run(async () => { const updated = await request<Workspace>("/v1/workspace", { method: "PATCH", body: JSON.stringify(changes) }); setWorkspace(updated); })} onChangePassword={async (currentPassword, newPassword) => { await request("/v1/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }); signOut(); }} onSwitch={changeWorkspace} />}
    </main>
    {dialog === "appointment" && <AppointmentDialog initial={editingAppointment} customers={customers} services={services.filter((service) => service.active || service.id === editingAppointment?.serviceId)} onClose={closeDialog} onSave={(payload) => run(() => request(editingAppointment ? `/v1/appointments/${editingAppointment.id}` : "/v1/appointments", { method: editingAppointment ? "PATCH" : "POST", body: JSON.stringify(payload) })).then((saved) => { if (saved) closeDialog(); })} />}
    {dialog === "customer" && <CustomerDialog initial={editingCustomer} onClose={closeDialog} onSave={(payload) => run(() => request(editingCustomer ? `/v1/customers/${editingCustomer.id}` : "/v1/customers", { method: editingCustomer ? "PATCH" : "POST", body: JSON.stringify(payload) })).then((saved) => { if (saved) closeDialog(); })} />}
    {dialog === "service" && <ServiceDialog initial={editingService} currency={workspace?.currency ?? "TWD"} onClose={closeDialog} onSave={(payload) => run(() => request(editingService ? `/v1/services/${editingService.id}` : "/v1/services", { method: editingService ? "PATCH" : "POST", body: JSON.stringify(payload) })).then((saved) => { if (saved) closeDialog(); })} />}
  </div>;
}

function AuthScreen({ onSession }: { onSession: (session: { token: string; workspaceId: string; role: string }) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState(""); const [workspaceName, setWorkspaceName] = useState("");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const body = mode === "register" ? { name, workspaceName, email, password } : { email, password };
      const response = await fetch(`${apiUrl}/v1/auth/${mode}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { data?: { token: string; workspaceId: string; user: { role: string } }; message?: string; error?: string };
      if (!response.ok || !result.data) throw new Error(result.message ?? result.error ?? "無法登入，請確認資料後重試。");
      onSession({ token: result.data.token, workspaceId: result.data.workspaceId, role: result.data.user.role });
    } catch (authError) { setError(authError instanceof Error ? authError.message : "認證服務暫時無法使用。"); }
    finally { setBusy(false); }
  };
  const demo = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiUrl}/v1/auth/demo`, { method: "POST" });
      const result = await response.json() as { data?: { token: string; workspaceId: string; user: { role: string } }; message?: string };
      if (!response.ok || !result.data) throw new Error(result.message ?? "展示工作區目前無法使用。");
      onSession({ token: result.data.token, workspaceId: result.data.workspaceId, role: result.data.user.role });
    } catch (authError) { setError(authError instanceof Error ? authError.message : "展示登入失敗。"); }
    finally { setBusy(false); }
  };
  return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><span className="brand-mark">B</span><strong>bookwise</strong><span>STUDIO</span></div><span className="section-label">{mode === "login" ? "WELCOME BACK" : "START YOUR WORKSPACE"}</span><h1>{mode === "login" ? "登入你的工作台" : "建立專屬工作區"}</h1><p className="auth-subtitle">{mode === "login" ? "管理預約、客戶與每一項服務。" : "建立帳號後，你會獲得獨立的工作區與資料範圍。"}</p>{error && <div className="form-error" role="alert">{error}</div>}<form onSubmit={(event) => void submit(event)}>{mode === "register" && <><label>你的姓名<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} autoComplete="name" /></label><label>工作區名稱<input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} required maxLength={100} placeholder="例如：光嶼顧問工作室" /></label></>}<label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label><label>密碼<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "register" ? 12 : 1} autoComplete={mode === "register" ? "new-password" : "current-password"} />{mode === "register" && <small className="field-hint">至少 12 個字元</small>}</label><button className="primary auth-submit" type="submit" disabled={busy}>{busy ? "處理中…" : mode === "login" ? "登入" : "建立帳號"}</button></form><button className="auth-mode-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "還沒有帳號？建立工作區" : "已經有帳號？返回登入"}</button>{import.meta.env.DEV && <><div className="auth-divider"><span>或</span></div><button className="demo-login" onClick={() => void demo()} disabled={busy}><span className="online-dot" />進入範例展示工作區</button><p className="auth-footnote">範例展示帳號只適用於本機開發環境。</p></>}</section></main>;
}

function pageTitle(page: Page) { return ({ dashboard: "早安，今天一切就緒", appointments: "預約管理", customers: "客戶關係", services: "服務目錄", reports: "營運洞察", settings: "工作區設定" })[page]; }
function DashboardPage({ dashboard, appointments, customers, services, currency, loading, onNew, onGo, onStatus }: { dashboard: Dashboard; appointments: Appointment[]; customers: Customer[]; services: Service[]; currency: string; loading: boolean; onNew: () => void; onGo: (page: Page) => void; onStatus: (appointment: Appointment, status: Appointment["status"]) => void }) {
  return <>
    <section className="hero"><div><span className="tag">{dateLabel}</span><h2>讓每一次相遇，<br /><em>都成為好體驗。</em></h2><p>預約、客戶與服務營運，在一個工作台清楚掌握。</p></div><button className="primary" onClick={onNew}><Plus size={18} />建立預約</button></section>
    <section className="metrics"><Metric label="今日預約" value={String(dashboard.todayAppointments).padStart(2, "0")} detail={`${dashboard.pendingAppointments} 筆待確認`} icon={<CalendarDays size={18} />} /><Metric label="本月營收" value={money(dashboard.monthlyRevenue, currency)} detail="依已確認與已完成預約計算" icon={<WalletCards size={18} />} /><Metric label="客戶總數" value={String(dashboard.customerCount)} detail="累積客戶資料" icon={<Users size={18} />} /><Metric label="啟用服務" value={String(dashboard.activeServiceCount)} detail="可接受預約的服務" icon={<Clock3 size={18} />} /></section>
    <section className="content-grid dashboard-grid"><div className="panel schedule"><PanelHeading kicker="TODAY" title="今日行程" action="全部預約" onAction={() => onGo("appointments")} /><div className="appointments">{loading ? <Empty>正在載入預約…</Empty> : dashboard.appointments.length ? dashboard.appointments.map((item) => <AppointmentRow key={item.id} appointment={item} onStatus={onStatus} />) : <Empty>今天還沒有預約，建立第一筆行程吧。</Empty>}</div></div><div className="panel quick-panel"><PanelHeading kicker="QUICK ACCESS" title="快速管理" /><button className="quick-link" onClick={() => onGo("customers")}><span className="quick-icon"><Users size={18} /></span><span><strong>客戶名單</strong><small>{customers.length} 位客戶</small></span><span>→</span></button><button className="quick-link" onClick={() => onGo("services")}><span className="quick-icon violet"><WalletCards size={18} /></span><span><strong>服務與定價</strong><small>{services.filter((item) => item.active).length} 項啟用中</small></span><span>→</span></button><button className="quick-link" onClick={() => onGo("reports")}><span className="quick-icon amber"><BarChart3 size={18} /></span><span><strong>營運報表</strong><small>查看業務成效</small></span><span>→</span></button></div></section>
  </>;
}
function AppointmentsPage({ appointments, customers, services, loading, onNew, onEdit, onStatus, onDelete }: { appointments: Appointment[]; customers: Customer[]; services: Service[]; loading: boolean; onNew: () => void; onEdit: (appointment: Appointment) => void; onStatus: (appointment: Appointment, status: Appointment["status"]) => void; onDelete: (appointment: Appointment) => void }) {
  const [q, setQ] = useState(""); const [status, setStatus] = useState("all");
  const filtered = appointments.filter((item) => `${item.customerName} ${item.service} ${item.notes}`.toLocaleLowerCase("zh-TW").includes(q.toLocaleLowerCase("zh-TW")) && (status === "all" || item.status === status));
  return <><section className="section-intro"><div><p>管理所有預約時段、確認狀態與服務內容。</p><small>{appointments.length} 筆預約 · {customers.length} 位客戶 · {services.length} 項服務</small></div><button className="primary" onClick={onNew}><Plus size={17} />新增預約</button></section><div className="panel table-panel"><div className="table-toolbar"><label className="search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋客戶、服務或備註" /></label><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">所有狀態</option><option value="pending">待確認</option><option value="confirmed">已確認</option><option value="completed">已完成</option><option value="cancelled">已取消</option></select></div>{loading ? <Empty>載入資料中…</Empty> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>日期與時間</th><th>客戶</th><th>服務</th><th>金額</th><th>狀態</th><th>操作</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{dateTime(item.startsAt)}</strong><small>{item.durationMinutes} 分鐘</small></td><td>{item.customerName}</td><td>{item.service}</td><td>{money(item.price)}</td><td><StatusSelect value={item.status} onChange={(value) => onStatus(item, value)} /></td><td><div className="row-actions"><button className="icon-button" aria-label="編輯預約" onClick={() => onEdit(item)}><Pencil size={15} /></button><button className="icon-button danger" aria-label="刪除預約" onClick={() => onDelete(item)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div> : <Empty>找不到符合條件的預約</Empty>}</div></>;
}
function CustomersPage({ customers, appointments, loading, onNew, onEdit, onDelete }: { customers: Customer[]; appointments: Appointment[]; loading: boolean; onNew: () => void; onEdit: (customer: Customer) => void; onDelete: (customer: Customer) => void }) {
  const [q, setQ] = useState(""); const filtered = customers.filter((item) => `${item.name} ${item.email} ${item.phone} ${item.tags.join(" ")}`.toLocaleLowerCase("zh-TW").includes(q.toLocaleLowerCase("zh-TW")));
  return <><section className="section-intro"><div><p>集中管理聯絡資料、標籤、備註與預約往來。</p><small>{customers.length} 位客戶 · {appointments.length} 筆關聯預約</small></div><button className="primary" onClick={onNew}><Plus size={17} />新增客戶</button></section><div className="panel table-panel"><div className="table-toolbar"><label className="search"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋姓名、Email、電話或標籤" /></label><span className="subtle">{filtered.length} 位客戶</span></div>{loading ? <Empty>載入資料中…</Empty> : filtered.length ? <div className="table-scroll"><table><thead><tr><th>客戶</th><th>聯絡方式</th><th>標籤</th><th>預約次數</th><th>加入日期</th><th>操作</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><div className="customer-cell"><span className="customer-avatar">{item.name.slice(0, 1)}</span><strong>{item.name}</strong></div></td><td><strong>{item.email || "—"}</strong><small>{item.phone || "未提供電話"}</small></td><td><div className="tag-list">{item.tags.length ? item.tags.map((tag) => <span className="mini-tag" key={tag}>{tag}</span>) : "—"}</div></td><td>{appointments.filter((booking) => booking.customerId === item.id).length}</td><td>{new Date(item.createdAt).toLocaleDateString("zh-TW")}</td><td><div className="row-actions"><button className="icon-button" aria-label="編輯客戶" onClick={() => onEdit(item)}><Pencil size={15} /></button><button className="icon-button danger" aria-label="刪除客戶" onClick={() => onDelete(item)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div> : <Empty>尚無客戶資料，新增第一位客戶。</Empty>}</div></>;
}
function ServicesPage({ services, appointments, currency, loading, onNew, onEdit, onToggle, onDelete }: { services: Service[]; appointments: Appointment[]; currency: string; loading: boolean; onNew: () => void; onEdit: (service: Service) => void; onToggle: (service: Service) => void; onDelete: (service: Service) => void }) {
  return <><section className="section-intro"><div><p>建立符合不同方案與案件的服務目錄，設定價格、時長與公開狀態。</p><small>{services.filter((item) => item.active).length} 項啟用 · {services.length} 項服務</small></div><button className="primary" onClick={onNew}><Plus size={17} />新增服務</button></section>{loading ? <div className="panel"><Empty>載入資料中…</Empty></div> : services.length ? <div className="service-grid">{services.map((item) => <article className={`service-card ${!item.active ? "inactive" : ""}`} key={item.id}><div className="service-card-top"><span className="service-swatch" style={{ background: item.color }} /><span className={item.active ? "active-pill" : "inactive-pill"}>{item.active ? "啟用中" : "已停用"}</span><button className="icon-button" aria-label="服務選項" onClick={() => onEdit(item)}><Pencil size={15} /></button></div><h3>{item.name}</h3><p>{item.description || "尚未新增服務說明"}</p><div className="service-meta"><span><Clock3 size={15} />{item.durationMinutes} 分鐘</span><strong>{money(item.price, item.currency || currency)}</strong></div><div className="service-actions"><button className="secondary" onClick={() => onEdit(item)}>編輯服務</button><button className="secondary" onClick={() => onToggle(item)}>{item.active ? "停用" : "啟用"}</button><button className="icon-button danger" aria-label="刪除服務" disabled={appointments.some((booking) => booking.serviceId === item.id)} onClick={() => onDelete(item)}><Trash2 size={15} /></button></div></article>)}</div> : <div className="panel"><Empty>尚無服務項目，新增一項服務開始接受預約。</Empty></div>}</>;
}
function ReportsPage({ report, currency, loading }: { report: Report | null; currency: string; loading: boolean }) {
  const max = Math.max(1, ...(report?.byDay.map((item) => item.revenue) ?? []));
  return <><section className="section-intro"><div><p>透過預約量與服務營收掌握近期營運狀況。</p><small>依目前工作區預約資料即時計算</small></div></section>{loading || !report ? <div className="panel"><Empty>正在整理報表資料…</Empty></div> : <><section className="metrics report-metrics"><Metric label="預約總數" value={String(report.totalAppointments)} detail="不含已取消預約" icon={<CalendarDays size={18} />} /><Metric label="確認營收" value={money(report.revenue, currency)} detail="已確認及已完成" icon={<WalletCards size={18} />} /><Metric label="平均預約金額" value={money(report.averageBookingValue, currency)} detail="營收 ÷ 預約數" icon={<BarChart3 size={18} />} /></section><section className="content-grid report-grid"><div className="panel"><PanelHeading kicker="REVENUE TREND" title="每日營收" /><div className="report-bars">{report.byDay.length ? report.byDay.slice(-14).map((item) => <div className="report-bar-item" key={item.date} title={`${item.date}: ${money(item.revenue, currency)}`}><span className="report-bar-value">{item.revenue ? money(item.revenue, currency) : "—"}</span><i style={{ height: `${Math.max(3, item.revenue / max * 100)}%` }} /><small>{item.date.slice(5)}</small></div>) : <Empty>完成或確認預約後，這裡會顯示營收趨勢。</Empty>}</div></div><div className="panel"><PanelHeading kicker="SERVICE MIX" title="服務表現" />{report.byService.length ? <div className="service-report-list">{report.byService.sort((a, b) => b.revenue - a.revenue).map((item) => <div className="service-report-row" key={item.service}><span><strong>{item.service}</strong><small>{item.count} 筆預約</small></span><strong>{money(item.revenue, currency)}</strong></div>)}</div> : <Empty>目前沒有可分析的預約。</Empty>}</div></section></>}</>;
}
function SettingsPage({ workspace, workspaceId, canSwitch, onSave, onChangePassword, onSwitch }: { workspace: Workspace; workspaceId: string; canSwitch: boolean; onSave: (changes: Partial<Workspace>) => void; onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>; onSwitch: (id: string) => void }) {
  const [name, setName] = useState(workspace.name); const [color, setColor] = useState(workspace.brandColor); const [currency, setCurrency] = useState(workspace.currency); const [timezone, setTimezone] = useState(workspace.timezone); const [tenant, setTenant] = useState(workspaceId); const [saved, setSaved] = useState(false);
  useEffect(() => { setName(workspace.name); setColor(workspace.brandColor); setCurrency(workspace.currency); setTimezone(workspace.timezone); }, [workspace]);
  const features = [{ id: "dashboard", label: "總覽", description: "營運摘要和快速入口" }, { id: "appointments", label: "預約管理", description: "預約建立、狀態更新與搜尋" }, { id: "customers", label: "客戶資料", description: "客戶聯絡資料、標籤和備註" }, { id: "services", label: "服務項目", description: "服務定價、時長與啟用狀態" }, { id: "reports", label: "營運報表", description: "預約和營收彙總" }, { id: "settings", label: "工作區設定", description: "品牌、幣別與模組管理" }];
  const save = () => { onSave({ name: name.trim(), brandColor: color, currency, timezone }); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  const toggle = (id: string, enabled: boolean) => onSave({ features: { ...workspace.features, [id]: enabled } });
  const [currentPassword, setCurrentPassword] = useState(""); const [newPassword, setNewPassword] = useState(""); const [passwordError, setPasswordError] = useState(""); const [passwordSaved, setPasswordSaved] = useState(false);
  const changePassword = async (event: React.FormEvent) => { event.preventDefault(); setPasswordError(""); if (newPassword.length < 12) { setPasswordError("新密碼至少需要 12 個字元。"); return; } try { await onChangePassword(currentPassword, newPassword); setPasswordSaved(true); } catch (cause) { setPasswordError(cause instanceof Error ? cause.message : "密碼更新失敗。"); } };
  return <><section className="section-intro"><div><p>自訂品牌、工作區識別與功能模組，適配不同客戶或服務案件。</p><small>變更只會套用到此工作區</small></div><button className="primary" onClick={save}>{saved ? <Check size={17} /> : <Check size={17} />}{saved ? "已儲存" : "儲存設定"}</button></section><div className="settings-layout"><section className="panel settings-panel"><PanelHeading kicker="BRAND & LOCALE" title="品牌與地區" /><div className="settings-fields"><label>工作區名稱<input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></label><label>主要幣別<select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="TWD">TWD · 新台幣</option><option value="USD">USD · 美元</option><option value="JPY">JPY · 日圓</option><option value="HKD">HKD · 港幣</option><option value="EUR">EUR · 歐元</option></select></label><label>時區<select value={timezone} onChange={(e) => setTimezone(e.target.value)}><option value="Asia/Taipei">Asia/Taipei</option><option value="Asia/Tokyo">Asia/Tokyo</option><option value="Asia/Hong_Kong">Asia/Hong_Kong</option><option value="America/Los_Angeles">America/Los_Angeles</option><option value="America/New_York">America/New_York</option><option value="Europe/London">Europe/London</option></select></label><label>品牌主色<div className="color-field"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /><input value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} /></div></label></div></section><section className="panel settings-panel"><PanelHeading kicker="MODULES" title="功能模組" /><p className="settings-hint">依照不同案件需求開關導覽模組，停用不會刪除模組資料。</p><div className="feature-list">{features.map((feature) => <label className="feature-row" key={feature.id}><span><strong>{feature.label}</strong><small>{feature.description}</small></span><input type="checkbox" checked={workspace.features[feature.id] !== false} onChange={(e) => toggle(feature.id, e.target.checked)} /></label>)}</div></section><section className="panel settings-panel tenant-panel"><PanelHeading kicker="WORKSPACE SCOPE" title="切換工作區" /><p className="settings-hint">每個工作區的預約、客戶與服務資料彼此隔離。使用英數字、底線或連字號。</p><form className="tenant-switch" onSubmit={(e) => { e.preventDefault(); onSwitch(tenant); }}><input value={tenant} onChange={(e) => setTenant(e.target.value)} maxLength={80} /><button className="secondary" type="submit">切換工作區</button></form><div className="notice"><CircleAlert size={16} /><span>目前是供展示與客製的範例 workspace，資料已儲存在本機。真實租戶上線前仍須部署正式資料庫、workspace membership 與完整角色權限。</span></div></section></div></>;
}
function AppointmentDialog({ initial, customers, services, onClose, onSave }: { initial: Appointment | null; customers: Customer[]; services: Service[]; onClose: () => void; onSave: (payload: object) => Promise<void> }) {
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [serviceId, setServiceId] = useState(initial?.serviceId ?? services.find((item) => item.name === initial?.service)?.id ?? "");
  const [startsAt, setStartsAt] = useState(() => initial ? localDateTime(new Date(initial.startsAt)) : localDateTime(new Date(Date.now() + 86_400_000)));
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 60);
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<Appointment["status"]>(initial?.status ?? "pending");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const selectedService = services.find((item) => item.id === serviceId);
  const chooseService = (id: string) => { setServiceId(id); const chosen = services.find((item) => item.id === id); if (chosen) { setDuration(chosen.durationMinutes); setPrice(chosen.price); } };
  const chooseCustomer = (id: string) => { setCustomerId(id); const chosen = customers.find((item) => item.id === id); if (chosen) setCustomerName(chosen.name); };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!customerName.trim() || !serviceId) { setError("請填寫客戶姓名並選擇服務。"); return; } setSaving(true); setError(""); try { await onSave({ customerName: customerName.trim(), customerId: customerId || undefined, serviceId, service: selectedService?.name ?? "自訂服務", startsAt: new Date(startsAt).toISOString(), durationMinutes: duration, price, status, notes }); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "建立失敗"); } finally { setSaving(false); } };
  return <Modal title={initial ? "編輯預約" : "建立預約"} kicker={initial ? "EDIT BOOKING" : "NEW BOOKING"} onClose={onClose}>
    <form onSubmit={(e) => void submit(e)}>
      {error && <div className="form-error">{error}</div>}
      <label>客戶<select value={customerId} onChange={(e) => chooseCustomer(e.target.value)}><option value="">選擇既有客戶，或下方輸入新客戶</option>{customers.map((item) => <option value={item.id} key={item.id}>{item.name}{item.phone ? ` · ${item.phone}` : ""}</option>)}</select></label>
      <label>客戶姓名<input value={customerName} onChange={(e) => { setCustomerName(e.target.value); if (customerId) setCustomerId(""); }} placeholder="客戶姓名" required /></label>
      <label>服務項目<select value={serviceId} onChange={(e) => chooseService(e.target.value)} required><option value="">選擇服務</option>{services.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.durationMinutes} 分鐘</option>)}</select></label>
      <div className="form-row">
        <label>開始時間<input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required /></label>
        <label>時長（分鐘）<input type="number" min="1" max="480" value={duration} onChange={(e) => setDuration(Number(e.target.value))} required /></label>
      </div>
      <div className="form-row">
        <label>金額<input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
        <label>狀態<select value={status} onChange={(e) => setStatus(e.target.value as Appointment["status"])}><option value="pending">待確認</option><option value="confirmed">已確認</option></select></label>
      </div>
      <label>備註<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="選填：需求或注意事項" /></label>
      <ModalActions onClose={onClose} saving={saving} label={initial ? "儲存變更" : "建立預約"} />
    </form>
  </Modal>;
}
function CustomerDialog({ initial, onClose, onSave }: { initial: Customer | null; onClose: () => void; onSave: (payload: object) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? ""); const [email, setEmail] = useState(initial?.email ?? ""); const [phone, setPhone] = useState(initial?.phone ?? ""); const [notes, setNotes] = useState(initial?.notes ?? ""); const [tags, setTags] = useState(initial?.tags.join(", ") ?? ""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setError(""); try { await onSave({ name, email, phone, notes, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean) }); } catch (e) { setError(e instanceof Error ? e.message : "儲存失敗"); } finally { setSaving(false); } };
  return <Modal title={initial ? "編輯客戶" : "新增客戶"} kicker="CUSTOMER PROFILE" onClose={onClose}>
    <form onSubmit={(e) => void submit(e)}>
      {error && <div className="form-error">{error}</div>}
      <label>姓名<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></label>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>電話<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label>客戶標籤<input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="以逗號分隔，例如：回訪, 顧問" /></label>
      <label>備註<textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <ModalActions onClose={onClose} saving={saving} label={initial ? "儲存變更" : "建立客戶"} />
    </form>
  </Modal>;
}
function ServiceDialog({ initial, currency, onClose, onSave }: { initial: Service | null; currency: string; onClose: () => void; onSave: (payload: object) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? ""); const [description, setDescription] = useState(initial?.description ?? ""); const [duration, setDuration] = useState(initial?.durationMinutes ?? 60); const [price, setPrice] = useState(initial?.price ?? 0); const [color, setColor] = useState(initial?.color ?? "#27856f"); const [active, setActive] = useState(initial?.active ?? true); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setError(""); try { await onSave({ name, description, durationMinutes: duration, price, currency, color, active }); } catch (e) { setError(e instanceof Error ? e.message : "儲存失敗"); } finally { setSaving(false); } };
  return <Modal title={initial ? "編輯服務" : "新增服務"} kicker="SERVICE CATALOG" onClose={onClose}>
    <form onSubmit={(e) => void submit(e)}>
      {error && <div className="form-error">{error}</div>}
      <label>服務名稱<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></label>
      <label>服務說明<textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="form-row">
        <label>服務時長（分鐘）<input type="number" min="1" max="480" value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></label>
        <label>定價（{currency}）<input type="number" min="0" step="1" value={price} onChange={(e) => setPrice(Number(e.target.value))} /></label>
      </div>
      <label>服務顏色<div className="color-field"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /><input value={color} onChange={(e) => setColor(e.target.value)} /></div></label>
      <label className="checkbox-label"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />啟用並接受此服務預約</label>
      <ModalActions onClose={onClose} saving={saving} label={initial ? "儲存變更" : "建立服務"} />
    </form>
  </Modal>;
}
function Modal({ title, kicker, onClose, children }: { title: string; kicker: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true"><div className="modal-header"><div><span className="section-label">{kicker}</span><h3>{title}</h3></div><button type="button" className="icon-button" onClick={onClose} aria-label="關閉"><X size={18} /></button></div>{children}</section></div>; }
function ModalActions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) { return <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button type="submit" className="primary" disabled={saving}>{saving ? "儲存中…" : <><Check size={17} />{label}</>}</button></div>; }
function PanelHeading({ kicker, title, action, onAction }: { kicker: string; title: string; action?: string; onAction?: () => void }) { return <div className="panel-heading"><div><span className="section-label">{kicker}</span><h3>{title}</h3></div>{action && <button className="text-button" onClick={onAction}>{action} →</button>}</div>; }
function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) { return <article className="metric"><span className="metric-icon">{icon}</span><span className="metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="empty-state">{children}</div>; }
function StatusSelect({ value, onChange }: { value: Appointment["status"]; onChange: (value: Appointment["status"]) => void }) { return <select className={`status-select ${value}`} value={value} onChange={(e) => onChange(e.target.value as Appointment["status"])}><option value="pending">待確認</option><option value="confirmed">已確認</option><option value="completed">已完成</option><option value="cancelled">已取消</option></select>; }
function AppointmentRow({ appointment, onStatus }: { appointment: Appointment; onStatus: (appointment: Appointment, status: Appointment["status"]) => void }) { return <div className="appointment"><div className="appointment-time"><strong>{new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(appointment.startsAt))}</strong><span>{appointment.durationMinutes} min</span></div><div className="appointment-line" /><div className="appointment-detail"><span className="customer-avatar">{appointment.customerName.slice(0, 1)}</span><div><strong>{appointment.customerName}</strong><span>{appointment.service}</span></div></div><StatusSelect value={appointment.status} onChange={(status) => onStatus(appointment, status)} /></div>; }

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
