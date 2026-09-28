import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { AuthService, loginSchema, registerSchema, type Claims } from "./auth.js";
import {
  apiResponse, createAppointmentSchema, createCustomerSchema, createServiceSchema,
  updateAppointmentSchema, updateCustomerSchema, updateServiceSchema, updateWorkspaceSchema,
  type Appointment, type Customer, type Dashboard, type Service, type Workspace,
} from "@bookwise/shared";
import { z } from "zod";
import { PrismaClient } from "../generated/client/index.js";
import { PrismaAccountStore, PrismaBookingRepository } from "./prisma-repository.js";

const envFile = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")].find(existsSync);
if (envFile) loadEnvFile(envFile);

const workspaceIdFrom = (request: FastifyRequest, claims: WeakMap<FastifyRequest, Claims>) => {
  const identity = claims.get(request);
  if (identity && identity.role !== "DEMO") return identity.workspaceId;
  const requested = request.headers["x-workspace-id"];
  return typeof requested === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(requested) ? requested : "demo-workspace";
};
const dayKey = (date: Date, timeZone = "Asia/Taipei") => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const todayAt = (hours: number, minutes = 0) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

export const seedAppointments: Appointment[] = [
  { id: "apt_001", customerId: "cus_001", serviceId: "svc_001", customerName: "林怡君", service: "初次諮詢", startsAt: todayAt(10), durationMinutes: 60, status: "confirmed", price: 2400, notes: "準備品牌定位簡報", createdAt: new Date().toISOString() },
  { id: "apt_002", customerId: "cus_002", serviceId: "svc_002", customerName: "陳柏翰", service: "品牌策略工作坊", startsAt: todayAt(13, 30), durationMinutes: 90, status: "pending", price: 6800, notes: "", createdAt: new Date().toISOString() },
  { id: "apt_003", customerId: "cus_003", serviceId: "svc_003", customerName: "王思妤", service: "回訪會議", startsAt: todayAt(15, 30), durationMinutes: 45, status: "confirmed", price: 0, notes: "", createdAt: new Date().toISOString() },
];
export const seedCustomers: Customer[] = [
  { id: "cus_001", name: "林怡君", email: "yijun@example.com", phone: "0912-345-678", notes: "品牌顧問客戶", tags: ["回訪", "顧問"], createdAt: new Date().toISOString() },
  { id: "cus_002", name: "陳柏翰", email: "bohan@example.com", phone: "0922-456-789", notes: "", tags: ["新客戶"], createdAt: new Date().toISOString() },
  { id: "cus_003", name: "王思妤", email: "", phone: "0933-567-890", notes: "偏好下午時段", tags: ["回訪"], createdAt: new Date().toISOString() },
];
export const seedServices: Service[] = [
  { id: "svc_001", name: "初次諮詢", description: "了解需求與合作方向", durationMinutes: 60, price: 2400, currency: "TWD", active: true, color: "#27856f" },
  { id: "svc_002", name: "品牌策略工作坊", description: "深度品牌策略共創", durationMinutes: 90, price: 6800, currency: "TWD", active: true, color: "#8870c2" },
  { id: "svc_003", name: "回訪會議", description: "專案進度與成效追蹤", durationMinutes: 45, price: 0, currency: "TWD", active: true, color: "#d79a51" },
];
export const defaultWorkspace: Workspace = {
  id: "demo-workspace", name: "光嶼顧問工作室", timezone: "Asia/Taipei", currency: "TWD", locale: "zh-TW",
  brandColor: "#197d68", features: { dashboard: true, appointments: true, customers: true, services: true, reports: true, settings: true },
};

/** Repository boundary keeps API contracts independent from memory, SQL, or other storage providers. */
type MaybePromise<T> = T | Promise<T>;
export interface BookingRepository {
  appointments(workspaceId: string): MaybePromise<Appointment[]>;
  customers(workspaceId: string): MaybePromise<Customer[]>;
  services(workspaceId: string): MaybePromise<Service[]>;
  workspace(workspaceId: string): MaybePromise<Workspace>;
  putAppointment(workspaceId: string, value: Appointment): MaybePromise<void>;
  putCustomer(workspaceId: string, value: Customer): MaybePromise<void>;
  putService(workspaceId: string, value: Service): MaybePromise<void>;
  putWorkspace(value: Workspace): MaybePromise<void>;
  updateAppointment(workspaceId: string, id: string, changes: Partial<Appointment>): MaybePromise<Appointment | undefined>;
  updateCustomer(workspaceId: string, id: string, changes: Partial<Customer>): MaybePromise<Customer | undefined>;
  updateService(workspaceId: string, id: string, changes: Partial<Service>): MaybePromise<Service | undefined>;
  deleteAppointment(workspaceId: string, id: string): MaybePromise<boolean>;
  deleteCustomer(workspaceId: string, id: string): MaybePromise<boolean>;
  deleteService(workspaceId: string, id: string): MaybePromise<boolean>;
}

export class MemoryBookingRepository implements BookingRepository {
  private readonly records = new Map<string, { appointments: Appointment[]; customers: Customer[]; services: Service[]; workspace: Workspace }>();
  private readonly persistPath?: string;

  constructor(initialAppointments: Appointment[] = seedAppointments, persistPath = process.env.NODE_ENV === "test" ? undefined : process.env.BOOKWISE_DATA_FILE) {
    this.persistPath = persistPath;
    this.records.set(defaultWorkspace.id, {
      appointments: structuredClone(initialAppointments), customers: structuredClone(seedCustomers),
      services: structuredClone(seedServices), workspace: structuredClone(defaultWorkspace),
    });
    if (this.persistPath) {
      try {
        const saved = JSON.parse(readFileSync(this.persistPath, "utf8")) as Record<string, ReturnType<MemoryBookingRepository["data"]>>;
        for (const [id, value] of Object.entries(saved)) this.records.set(id, value);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        this.persist();
      }
      }
  }

  private data(id: string) {
    let data = this.records.get(id);
    if (!data) {
      data = { appointments: [], customers: [], services: [], workspace: { ...structuredClone(defaultWorkspace), id, name: `${id} 工作區` } };
      this.records.set(id, data);
    }
    return data;
  }

  appointments(id: string) { return this.data(id).appointments; }
  customers(id: string) { return this.data(id).customers; }
  services(id: string) { return this.data(id).services; }
  workspace(id: string) { return this.data(id).workspace; }
  putAppointment(id: string, value: Appointment) { this.data(id).appointments.push(value); this.persist(); }
  putCustomer(id: string, value: Customer) { this.data(id).customers.push(value); this.persist(); }
  putService(id: string, value: Service) { this.data(id).services.push(value); this.persist(); }
  putWorkspace(value: Workspace) { this.data(value.id).workspace = value; this.persist(); }
  updateAppointment(id: string, recordId: string, changes: Partial<Appointment>) { return this.update(this.appointments(id), recordId, changes); }
  updateCustomer(id: string, recordId: string, changes: Partial<Customer>) { return this.update(this.customers(id), recordId, changes); }
  updateService(id: string, recordId: string, changes: Partial<Service>) { return this.update(this.services(id), recordId, changes); }
  deleteAppointment(id: string, recordId: string) { return this.remove(this.appointments(id), recordId); }
  deleteCustomer(id: string, recordId: string) { return this.remove(this.customers(id), recordId); }
  deleteService(id: string, recordId: string) { return this.remove(this.services(id), recordId); }

  private update<T extends { id: string }>(items: T[], id: string, changes: Partial<T>): T | undefined {
    const item = items.find((entry) => entry.id === id);
    if (!item) return undefined;
    Object.assign(item, changes);
    this.persist();
    return item;
  }

  private remove<T extends { id: string }>(items: T[], id: string) {
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    items.splice(index, 1);
    this.persist();
    return true;
  }

  private persist() {
    if (!this.persistPath) return;
    mkdirSync(dirname(this.persistPath), { recursive: true });
    const temporaryPath = `${this.persistPath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(Object.fromEntries(this.records), null, 2), { mode: 0o600 });
    renameSync(temporaryPath, this.persistPath);
  }
}

const invalid = (reply: FastifyReply, details: unknown) => reply.code(400).send({ error: "INVALID_INPUT", details });
const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "NOT_FOUND" });

export function buildApp(initialAppointments: Appointment[] = seedAppointments, repository: BookingRepository = new MemoryBookingRepository(initialAppointments), accountStore?: ConstructorParameters<typeof AuthService>[0]) {
  if (process.env.NODE_ENV === "production" && repository instanceof MemoryBookingRepository) throw new Error("The JSON repository is for local development only. Configure a durable production repository before deployment.");
  if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGIN) throw new Error("CORS_ORIGIN must be configured explicitly in production.");
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  let auth: AuthService;
  try { auth = new AuthService(accountStore); } catch (error) {
    app.log.error(error, "Authentication configuration is invalid.");
    throw error;
  }
  const claimsByRequest = new WeakMap<FastifyRequest, Claims>();
  const authRateLimits = new Map<string, { count: number; resetAt: number }>();
  const workspaceWriteLimits = new Map<string, { count: number; resetAt: number }>();
  const corsOrigins = process.env.CORS_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean);
  void app.register(cors, { origin: corsOrigins?.length ? corsOrigins : true });
  void app.register(helmet);

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health") return;
    if (request.url.startsWith("/api/v1/auth/")) {
      const key = `${request.ip}:${request.url}`;
      const now = Date.now();
      const current = authRateLimits.get(key);
      const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + 15 * 60_000 };
      bucket.count += 1;
      authRateLimits.set(key, bucket);
      if (authRateLimits.size > 10_000) for (const [entry, value] of authRateLimits) if (value.resetAt <= now) authRateLimits.delete(entry);
      const limit = request.url.endsWith("/demo") ? 100 : 10;
      if (bucket.count > limit) {
        reply.header("retry-after", Math.ceil((bucket.resetAt - now) / 1000));
        return reply.code(429).send({ error: "RATE_LIMITED", message: "登入嘗試次數過多，請稍後再試。" });
      }
      return;
    }
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const claims = await auth.verifyToken(token);
    if (!claims) return reply.code(401).send({ error: "UNAUTHENTICATED", message: "請先登入或重新登入。" });
    claimsByRequest.set(request, claims);
    if (claims.role !== "DEMO" && request.headers["x-workspace-id"] && request.headers["x-workspace-id"] !== claims.workspaceId) {
      return reply.code(403).send({ error: "WORKSPACE_FORBIDDEN", message: "目前帳號沒有此工作區的存取權。" });
    }
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method) && claims.role === "VIEWER") {
      return reply.code(403).send({ error: "INSUFFICIENT_ROLE", message: "此帳號僅有檢視權限。" });
    }
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      const key = claims.sub;
      const now = Date.now();
      const current = workspaceWriteLimits.get(key);
      const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + 60_000 };
      bucket.count += 1;
      workspaceWriteLimits.set(key, bucket);
      if (workspaceWriteLimits.size > 10_000) for (const [entry, value] of workspaceWriteLimits) if (value.resetAt <= now) workspaceWriteLimits.delete(entry);
      const limit = claims.role === "DEMO" ? 600 : 120;
      if (bucket.count > limit) {
        reply.header("retry-after", Math.ceil((bucket.resetAt - now) / 1000));
        return reply.code(429).send({ error: "RATE_LIMITED", message: "操作次數過多，請稍後再試。" });
      }
    }
  });

  app.get("/health", async () => ({ status: "ok", service: "bookwise-api" }));

  app.post("/api/v1/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    const account = await auth.register(parsed.data);
    if (!account) return reply.code(409).send({ error: "EMAIL_ALREADY_REGISTERED", message: "此 Email 已經註冊。" });
    await repository.putWorkspace({ ...structuredClone(defaultWorkspace), id: account.workspaceId, name: parsed.data.workspaceName });
    return reply.code(201).send(apiResponse({ ...account, workspace: await repository.workspace(account.workspaceId) }));
  });
  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    const session = await auth.login(parsed.data);
    if (!session) return reply.code(401).send({ error: "INVALID_CREDENTIALS", message: "Email 或密碼不正確。" });
    return apiResponse({ ...session, workspace: await repository.workspace(session.workspaceId) });
  });
  app.post("/api/v1/auth/password", async (request, reply) => {
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const claims = await auth.verifyToken(token);
    if (!claims || claims.role === "DEMO") return reply.code(401).send({ error: "UNAUTHENTICATED", message: "請先以正式帳號登入。" });
    const parsed = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(12).max(200) }).safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    if (!await auth.changePassword(claims.sub, parsed.data.currentPassword, parsed.data.newPassword)) return reply.code(400).send({ error: "INVALID_PASSWORD", message: "目前密碼不正確。" });
    return apiResponse({ changed: true, reauthenticate: true });
  });
  app.post("/api/v1/auth/demo", async (request, reply) => {
    if (process.env.NODE_ENV === "production") return reply.code(404).send({ error: "NOT_FOUND" });
    return apiResponse(auth.demoSession());
  });

  app.get("/api/v1/workspace", async (request) => apiResponse(await repository.workspace(workspaceIdFrom(request, claimsByRequest))));
  app.patch("/api/v1/workspace", async (request, reply) => {
    const parsed = updateWorkspaceSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    const current = await repository.workspace(workspaceIdFrom(request, claimsByRequest));
    const updated = { ...current, ...parsed.data, features: { ...current.features, ...parsed.data.features } };
    await repository.putWorkspace(updated);
    return apiResponse(updated);
  });

  app.get("/api/v1/dashboard", async (request): Promise<{ data: Dashboard; meta: { version: string } }> => {
    const workspaceId = workspaceIdFrom(request, claimsByRequest);
    const now = new Date();
    const workspace = await repository.workspace(workspaceId);
    const appointments = await repository.appointments(workspaceId);
    const timeZone = workspace.timezone;
    const today = dayKey(now, timeZone);
    const month = today.slice(0, 7);
    const currentMonthAppointments = appointments.filter((appointment) => dayKey(new Date(appointment.startsAt), timeZone).slice(0, 7) === month && appointment.status !== "cancelled");
    const data: Dashboard = {
      businessName: workspace.name,
      todayAppointments: appointments.filter((appointment) => dayKey(new Date(appointment.startsAt), timeZone) === today && appointment.status !== "cancelled").length,
      monthlyRevenue: currentMonthAppointments.filter((appointment) => ["confirmed", "completed"].includes(appointment.status)).reduce((sum, appointment) => sum + appointment.price, 0),
      occupancyRate: Math.min(100, Math.round((currentMonthAppointments.length / 40) * 100)),
      appointments: appointments.filter((appointment) => dayKey(new Date(appointment.startsAt), timeZone) === today).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      pendingAppointments: appointments.filter((appointment) => appointment.status === "pending").length,
      customerCount: (await repository.customers(workspaceId)).length,
      activeServiceCount: (await repository.services(workspaceId)).filter((service) => service.active).length,
    };
    return apiResponse(data);
  });

  app.get("/api/v1/appointments", async (request) => {
    const query = request.query as { q?: string; status?: string; from?: string; to?: string };
    const q = query.q?.toLocaleLowerCase("zh-TW");
    const appointments = (await repository.appointments(workspaceIdFrom(request, claimsByRequest))).filter((item) =>
      (!q || `${item.customerName} ${item.service} ${item.notes}`.toLocaleLowerCase("zh-TW").includes(q)) &&
      (!query.status || item.status === query.status) && (!query.from || item.startsAt >= query.from) && (!query.to || item.startsAt <= query.to),
    ).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return apiResponse(appointments);
  });
  app.post("/api/v1/appointments", async (request, reply) => {
    const parsed = createAppointmentSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    const workspaceId = workspaceIdFrom(request, claimsByRequest);
    if (parsed.data.customerId && !(await repository.customers(workspaceId)).some((customer) => customer.id === parsed.data.customerId)) return reply.code(422).send({ error: "INVALID_CUSTOMER", message: "所選客戶不存在於此工作區。" });
    if (parsed.data.serviceId) {
      const selectedService = (await repository.services(workspaceId)).find((service) => service.id === parsed.data.serviceId);
      if (!selectedService || !selectedService.active) return reply.code(422).send({ error: "INVALID_SERVICE", message: "此服務不存在或已停用。" });
    }
    const start = new Date(parsed.data.startsAt).getTime();
    const end = start + parsed.data.durationMinutes * 60_000;
    const collision = (await repository.appointments(workspaceId)).some((item) => item.status !== "cancelled" && start < new Date(item.startsAt).getTime() + item.durationMinutes * 60_000 && end > new Date(item.startsAt).getTime());
    if (collision) return reply.code(409).send({ error: "TIME_SLOT_UNAVAILABLE", message: "此時段已有其他預約，請選擇其他時間。" });
    const value: Appointment = { id: `apt_${randomUUID()}`, ...parsed.data, createdAt: new Date().toISOString() };
    await repository.putAppointment(workspaceId, value);
    return reply.code(201).send(apiResponse(value));
  });
  app.patch("/api/v1/appointments/:id", async (request, reply) => {
    const parsed = updateAppointmentSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    const workspaceId = workspaceIdFrom(request, claimsByRequest);
    const id = (request.params as { id: string }).id;
    const current = (await repository.appointments(workspaceId)).find((item) => item.id === id);
    if (!current) return notFound(reply);
    if (parsed.data.customerId && !(await repository.customers(workspaceId)).some((customer) => customer.id === parsed.data.customerId)) return reply.code(422).send({ error: "INVALID_CUSTOMER", message: "所選客戶不存在於此工作區。" });
    if (parsed.data.serviceId) {
      const selectedService = (await repository.services(workspaceId)).find((service) => service.id === parsed.data.serviceId);
      if (!selectedService || (!selectedService.active && current.serviceId !== selectedService.id)) return reply.code(422).send({ error: "INVALID_SERVICE", message: "此服務不存在或已停用。" });
    }
    if (parsed.data.status !== "cancelled") {
      const start = new Date(parsed.data.startsAt ?? current.startsAt).getTime();
      const duration = parsed.data.durationMinutes ?? current.durationMinutes;
      const end = start + duration * 60_000;
      const collision = (await repository.appointments(workspaceId)).some((item) => item.id !== id && item.status !== "cancelled" && start < new Date(item.startsAt).getTime() + item.durationMinutes * 60_000 && end > new Date(item.startsAt).getTime());
      if (collision) return reply.code(409).send({ error: "TIME_SLOT_UNAVAILABLE", message: "此時段已有其他預約，請選擇其他時間。" });
    }
    const updated = await repository.updateAppointment(workspaceId, id, parsed.data);
    if (!updated) return notFound(reply);
    return apiResponse(updated);
  });
  app.delete("/api/v1/appointments/:id", async (request, reply) => {
    if (!await repository.deleteAppointment(workspaceIdFrom(request, claimsByRequest), (request.params as { id: string }).id)) return notFound(reply);
    return reply.code(204).send();
  });

  app.get("/api/v1/customers", async (request) => {
    const q = ((request.query as { q?: string }).q ?? "").toLocaleLowerCase("zh-TW");
    return apiResponse((await repository.customers(workspaceIdFrom(request, claimsByRequest))).filter((item) => !q || `${item.name} ${item.email} ${item.phone} ${item.tags.join(" ")}`.toLocaleLowerCase("zh-TW").includes(q)));
  });
  app.post("/api/v1/customers", async (request, reply) => {
    const parsed = createCustomerSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    const value: Customer = { id: `cus_${randomUUID()}`, ...parsed.data, createdAt: new Date().toISOString() };
    await repository.putCustomer(workspaceIdFrom(request, claimsByRequest), value);
    return reply.code(201).send(apiResponse(value));
  });
  app.patch("/api/v1/customers/:id", async (request, reply) => {
    const parsed = updateCustomerSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    const updated = await repository.updateCustomer(workspaceIdFrom(request, claimsByRequest), (request.params as { id: string }).id, parsed.data);
    if (!updated) return notFound(reply);
    return apiResponse(updated);
  });
  app.delete("/api/v1/customers/:id", async (request, reply) => {
    const workspaceId = workspaceIdFrom(request, claimsByRequest);
    const id = (request.params as { id: string }).id;
    if ((await repository.appointments(workspaceId)).some((appointment) => appointment.customerId === id)) return reply.code(409).send({ error: "CUSTOMER_HAS_APPOINTMENTS", message: "客戶仍有預約紀錄；請封存客戶而非刪除。" });
    if (!await repository.deleteCustomer(workspaceId, id)) return notFound(reply);
    return reply.code(204).send();
  });

  app.get("/api/v1/services", async (request) => {
    const includeInactive = (request.query as { includeInactive?: string }).includeInactive === "true";
    return apiResponse((await repository.services(workspaceIdFrom(request, claimsByRequest))).filter((item) => includeInactive || item.active));
  });
  app.post("/api/v1/services", async (request, reply) => {
    const parsed = createServiceSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    const value: Service = { id: `svc_${randomUUID()}`, ...parsed.data };
    await repository.putService(workspaceIdFrom(request, claimsByRequest), value);
    return reply.code(201).send(apiResponse(value));
  });
  app.patch("/api/v1/services/:id", async (request, reply) => {
    const parsed = updateServiceSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, parsed.error.flatten());
    const updated = await repository.updateService(workspaceIdFrom(request, claimsByRequest), (request.params as { id: string }).id, parsed.data);
    if (!updated) return notFound(reply);
    return apiResponse(updated);
  });
  app.delete("/api/v1/services/:id", async (request, reply) => {
    const workspaceId = workspaceIdFrom(request, claimsByRequest);
    const id = (request.params as { id: string }).id;
    if ((await repository.appointments(workspaceId)).some((appointment) => appointment.serviceId === id)) return reply.code(409).send({ error: "SERVICE_HAS_APPOINTMENTS", message: "此服務已被預約使用；請停用而非刪除。" });
    if (!await repository.deleteService(workspaceId, id)) return notFound(reply);
    return reply.code(204).send();
  });

  app.get("/api/v1/reports", async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };
    const workspaceId = workspaceIdFrom(request, claimsByRequest);
    const timeZone = (await repository.workspace(workspaceId)).timezone;
    const appointments = (await repository.appointments(workspaceId)).filter((item) => item.status !== "cancelled" && (!from || item.startsAt >= from) && (!to || item.startsAt <= to));
    const revenue = appointments.filter((item) => ["confirmed", "completed"].includes(item.status)).reduce((sum, item) => sum + item.price, 0);
    const byService = Object.values(appointments.reduce<Record<string, { service: string; count: number; revenue: number }>>((groups, item) => {
      const group = groups[item.service] ??= { service: item.service, count: 0, revenue: 0 };
      group.count += 1;
      if (["confirmed", "completed"].includes(item.status)) group.revenue += item.price;
      return groups;
    }, {}));
    const byDay = Object.values(appointments.reduce<Record<string, { date: string; count: number; revenue: number }>>((groups, item) => {
      const date = dayKey(new Date(item.startsAt), timeZone);
      const group = groups[date] ??= { date, count: 0, revenue: 0 };
      group.count += 1;
      if (["confirmed", "completed"].includes(item.status)) group.revenue += item.price;
      return groups;
    }, {})).sort((a, b) => a.date.localeCompare(b.date));
    return apiResponse({ totalAppointments: appointments.length, revenue, averageBookingValue: appointments.length ? Math.round(revenue / appointments.length) : 0, byService, byDay });
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const start = async () => {
    if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) throw new Error("DATABASE_URL must be configured in production.");
    const prisma = process.env.DATABASE_URL ? new PrismaClient() : undefined;
    if (prisma) await prisma.$connect();
    const repository = prisma ? new PrismaBookingRepository(prisma) : new MemoryBookingRepository();
    const accountStore = prisma ? new PrismaAccountStore(prisma) : undefined;
    const app = buildApp(seedAppointments, repository, accountStore);
    if (prisma) app.addHook("onClose", () => prisma.$disconnect());
    const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
    await app.listen({ port, host: "0.0.0.0" });
  };
  start().catch((error) => { console.error(error); process.exit(1); });
}