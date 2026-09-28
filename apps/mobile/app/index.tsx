import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import type { Appointment, Dashboard } from "@bookwise/shared";

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/api";
const fallback: Dashboard = { businessName: "光嶼顧問工作室", todayAppointments: 3, monthlyRevenue: 128400, occupancyRate: 78, pendingAppointments: 1, customerCount: 3, activeServiceCount: 3, appointments: [
  { id: "1", customerName: "林怡君", service: "初次諮詢", startsAt: "2026-09-25T10:00:00+08:00", durationMinutes: 60, status: "confirmed", price: 2400, notes: "" },
  { id: "2", customerName: "陳柏翰", service: "品牌策略工作坊", startsAt: "2026-09-25T13:30:00+08:00", durationMinutes: 90, status: "pending", price: 6800, notes: "" },
] };
const time = (value: string) => new Date(value).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });

export default function Home() {
  const [dashboard, setDashboard] = useState(fallback);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { void (async () => { const saved = await readToken(); setToken(saved); setReady(true); })(); }, []);
  useEffect(() => {
    if (!token) return;
    fetch(`${apiUrl}/v1/dashboard`, { headers: { authorization: `Bearer ${token}` } })
      .then(async (response) => { if (response.status === 401) { await storeToken(null); setToken(null); throw new Error("登入已過期"); } if (!response.ok) throw new Error("載入失敗"); return response.json(); })
      .then((result) => setDashboard(result.data)).catch(() => undefined);
  }, [token]);
  const signOut = () => { void storeToken(null).then(() => setToken(null)); };
  if (!ready) return <SafeAreaView style={authStyles.safe}><View style={authStyles.loading}><ActivityIndicator color="#197d68" /><Text style={styles.heroText}>載入工作區…</Text></View></SafeAreaView>;
  if (!token) return <MobileSignIn onSuccess={setToken} />;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><View style={styles.top}><View><Text style={styles.kicker}>BOOKWISE / 今日</Text><Text style={styles.title}>早安，光嶼團隊</Text></View><Pressable onPress={signOut} style={authStyles.logout}><Text style={authStyles.logoutText}>登出</Text></Pressable><View style={styles.logo}><Text style={styles.logoText}>B</Text></View></View><View style={styles.hero}><Text style={styles.heroKicker}>今日工作台</Text><Text style={styles.heroTitle}>把重要的會面，{`\n`}留給重要的人。</Text><Text style={styles.heroText}>所有預約都在這裡清楚掌握。</Text><Pressable style={styles.primary}><Ionicons name="add" color="#fff" size={18} /><Text style={styles.primaryText}>新增預約</Text></Pressable></View><View style={styles.cards}><Stat icon={<Ionicons name="calendar-outline" color="#197d68" size={18} />} label="今日預約" value={String(dashboard.todayAppointments)} /><Stat icon={<Ionicons name="people-outline" color="#197d68" size={18} />} label="本月營收" value={`$${Math.round(dashboard.monthlyRevenue / 1000)}k`} /><Stat icon={<Ionicons name="time-outline" color="#197d68" size={18} />} label="使用率" value={`${dashboard.occupancyRate}%`} /></View><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>今日行程</Text><Text style={styles.link}>查看全部</Text></View>{dashboard.appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}<View style={styles.tip}><Text style={styles.tipMark}>↗</Text><Text style={styles.tipText}>本月回訪率比上個月高出 18%。</Text></View></ScrollView></SafeAreaView>;
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <View style={styles.stat}><View style={styles.statIcon}>{icon}</View><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }
function AppointmentCard({ appointment }: { appointment: Appointment }) { return <View style={styles.appointment}><View style={styles.time}><Text style={styles.timeText}>{time(appointment.startsAt)}</Text><Text style={styles.duration}>{appointment.durationMinutes} min</Text></View><View style={styles.detail}><View style={styles.customer}><Text style={styles.customerText}>{appointment.customerName.slice(0, 1)}</Text></View><View><Text style={styles.customerName}>{appointment.customerName}</Text><Text style={styles.service}>{appointment.service}</Text></View></View><Ionicons name="chevron-forward" color="#aab5af" size={17} /></View>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#f6f7f5" }, container: { padding: 22, paddingBottom: 45 }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, kicker: { color: "#9aa7a1", fontSize: 10, letterSpacing: 1.4, marginBottom: 7 }, title: { color: "#172126", fontSize: 23, fontWeight: "700" }, logo: { width: 39, height: 39, borderRadius: 12, backgroundColor: "#197d68", justifyContent: "center", alignItems: "center" }, logoText: { color: "#fff", fontSize: 19, fontWeight: "700" }, hero: { marginTop: 39, padding: 21, borderRadius: 14, backgroundColor: "#dff1e9" }, heroKicker: { color: "#24816b", fontSize: 11, fontWeight: "700" }, heroTitle: { color: "#172126", fontSize: 28, lineHeight: 35, fontWeight: "800", marginTop: 13 }, heroText: { color: "#6f8178", fontSize: 12, marginTop: 10 }, primary: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 7, marginTop: 19, backgroundColor: "#197d68" }, primaryText: { color: "#fff", fontSize: 12, fontWeight: "700" }, cards: { flexDirection: "row", gap: 8, marginTop: 15 }, stat: { flex: 1, minHeight: 104, padding: 11, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e6ebe7" }, statIcon: { width: 29, height: 29, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: "#e4f4ee" }, statLabel: { color: "#9aa7a1", fontSize: 10, marginTop: 10 }, statValue: { color: "#172126", fontSize: 20, fontWeight: "700", marginTop: 5 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 31, marginBottom: 12 }, sectionTitle: { color: "#172126", fontSize: 19, fontWeight: "700" }, link: { color: "#25836e", fontSize: 11 }, appointment: { minHeight: 80, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, borderRadius: 10, marginBottom: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e6ebe7" }, time: { width: 49 }, timeText: { color: "#172126", fontSize: 14, fontWeight: "700" }, duration: { color: "#a4aea9", fontSize: 9, marginTop: 4 }, detail: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 }, customer: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", backgroundColor: "#f5e4d9" }, customerText: { color: "#8f5e47", fontSize: 12, fontWeight: "700" }, customerName: { color: "#172126", fontSize: 12, fontWeight: "700" }, service: { color: "#9aa7a1", fontSize: 10, marginTop: 4 }, tip: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, marginTop: 17, borderRadius: 8, backgroundColor: "#e6f5ed" }, tipMark: { color: "#21836d", fontSize: 19 }, tipText: { color: "#477166", fontSize: 11 } });
async function readToken() {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem("bookwise.token") ?? null;
  return SecureStore.getItemAsync("bookwise.token");
}
async function storeToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) globalThis.localStorage?.setItem("bookwise.token", token);
    else globalThis.localStorage?.removeItem("bookwise.token");
    return;
  }
  if (token) await SecureStore.setItemAsync("bookwise.token", token);
  else await SecureStore.deleteItemAsync("bookwise.token");
}
function MobileSignIn({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const signIn = async (demo: boolean) => {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiUrl}/v1/auth/${demo ? "demo" : "login"}`, demo ? { method: "POST" } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json() as { data?: { token: string }; message?: string; error?: string };
      if (!response.ok || !result.data) throw new Error(result.message ?? result.error ?? "登入失敗");
      await storeToken(result.data.token); onSuccess(result.data.token);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "無法連接認證服務"); }
    finally { setBusy(false); }
  };
  return <SafeAreaView style={authStyles.safe}><View style={authStyles.card}><View style={styles.logo}><Text style={styles.logoText}>B</Text></View><Text style={authStyles.brand}>bookwise</Text><Text style={authStyles.title}>登入工作台</Text><Text style={authStyles.subtitle}>使用網頁端建立的帳號登入</Text>{error ? <Text style={authStyles.error}>{error}</Text> : null}<TextInput style={authStyles.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" autoComplete="email" /><TextInput style={authStyles.input} value={password} onChangeText={setPassword} placeholder="密碼" secureTextEntry autoComplete="password" /><Pressable style={[authStyles.button, busy && authStyles.disabled]} onPress={() => void signIn(false)} disabled={busy}><Text style={authStyles.buttonText}>{busy ? "登入中…" : "登入"}</Text></Pressable><Pressable style={authStyles.demo} onPress={() => void signIn(true)} disabled={busy}><Text style={authStyles.demoText}>進入本機展示工作區</Text></Pressable></View></SafeAreaView>;
}
const authStyles = StyleSheet.create({ safe: { flex: 1, justifyContent: "center", backgroundColor: "#f6f7f5", padding: 22 }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }, card: { padding: 24, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5eae6" }, brand: { marginTop: 12, color: "#172126", fontSize: 19, fontWeight: "700" }, title: { marginTop: 29, color: "#172126", fontSize: 24, fontWeight: "800" }, subtitle: { marginTop: 7, marginBottom: 19, color: "#87948d", fontSize: 12 }, input: { height: 46, paddingHorizontal: 12, marginBottom: 11, color: "#172126", backgroundColor: "#fbfcfa", borderColor: "#dce5df", borderWidth: 1, borderRadius: 7 }, button: { alignItems: "center", padding: 13, marginTop: 4, backgroundColor: "#197d68", borderRadius: 7 }, disabled: { opacity: 0.6 }, buttonText: { color: "#fff", fontSize: 13, fontWeight: "700" }, demo: { alignItems: "center", padding: 12, marginTop: 11, borderRadius: 7, backgroundColor: "#eff5f0" }, demoText: { color: "#547167", fontSize: 11, fontWeight: "600" }, error: { marginBottom: 11, color: "#a1483d", fontSize: 11 }, logout: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: "#fff", borderRadius: 7, borderWidth: 1, borderColor: "#e5eae6" }, logoutText: { color: "#718078", fontSize: 10 } });