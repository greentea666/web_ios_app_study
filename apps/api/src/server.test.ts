import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildApp, MemoryBookingRepository } from "./server.js";

async function demoHeaders(app: ReturnType<typeof buildApp>, workspaceId = "demo-workspace") {
  const response = await app.inject({ method: "POST", url: "/api/v1/auth/demo" });
  const token = response.json().data.token as string;
  return { authorization: `Bearer ${token}`, "x-workspace-id": workspaceId };
}

async function demoClient(app: ReturnType<typeof buildApp>, workspaceId = "demo-workspace") {
  const headers = await demoHeaders(app, workspaceId);
  return (options: any) => app.inject({ ...options, headers: { ...headers, ...options.headers } });
}

test("appointments API supports the main booking flow", async (t) => {
  const app = buildApp([]);
  t.after(() => app.close());
  const inject = await demoClient(app);

  const health = await inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: "ok", service: "bookwise-api" });

  const invalid = await inject({
    method: "POST",
    url: "/api/v1/appointments",
    payload: { customerName: "", service: "諮詢", startsAt: "not-a-date", durationMinutes: 0 },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, "INVALID_INPUT");

  const created = await inject({
    method: "POST",
    url: "/api/v1/appointments",
    payload: {
      customerName: "測試客戶",
      service: "產品諮詢",
      startsAt: "2026-09-26T14:00:00+08:00",
      durationMinutes: 60,
    },
  });
  assert.equal(created.statusCode, 201);
  const appointment = created.json().data;
  assert.equal(appointment.status, "pending");

  const updated = await inject({
    method: "PATCH",
    url: `/api/v1/appointments/${appointment.id}`,
    payload: { status: "confirmed" },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().data.status, "confirmed");

  const listed = await inject({ method: "GET", url: "/api/v1/appointments" });
  assert.equal(listed.json().data.length, 1);

  const deleted = await inject({ method: "DELETE", url: `/api/v1/appointments/${appointment.id}` });
  assert.equal(deleted.statusCode, 204);

  const missing = await inject({ method: "GET", url: "/api/v1/appointments" });
  assert.equal(missing.json().data.length, 0);
});

test("workspace modules support CRUD, reports, and tenant isolation", async (t) => {
  const app = buildApp([]);
  t.after(() => app.close());
  const inject = await demoClient(app);
  const workspaceHeaders = { "x-workspace-id": "alpha-workspace" };
  const otherWorkspaceHeaders = { "x-workspace-id": "beta-workspace" };

  const emptyCustomers = await inject({ method: "GET", url: "/api/v1/customers", headers: workspaceHeaders });
  assert.deepEqual(emptyCustomers.json().data, []);
  const seedCustomers = await inject({ method: "GET", url: "/api/v1/customers" });
  assert.equal(seedCustomers.json().data.length, 3);

  const customerResponse = await inject({ method: "POST", url: "/api/v1/customers", headers: workspaceHeaders, payload: { name: "測試客戶", email: "client@example.com", phone: "0900", tags: ["VIP"] } });
  assert.equal(customerResponse.statusCode, 201);
  const customer = customerResponse.json().data;
  const editedCustomer = await inject({ method: "PATCH", url: `/api/v1/customers/${customer.id}`, headers: workspaceHeaders, payload: { phone: "0911" } });
  assert.equal(editedCustomer.json().data.phone, "0911");

  const serviceResponse = await inject({ method: "POST", url: "/api/v1/services", headers: workspaceHeaders, payload: { name: "案件策略會議", description: "客製案件", durationMinutes: 75, price: 3500 } });
  assert.equal(serviceResponse.statusCode, 201);
  const service = serviceResponse.json().data;
  assert.equal(service.currency, "TWD");

  const startsAt = "2030-01-15T10:00:00+08:00";
  const booking = await inject({ method: "POST", url: "/api/v1/appointments", headers: workspaceHeaders, payload: { customerName: customer.name, customerId: customer.id, service: service.name, serviceId: service.id, startsAt, durationMinutes: 60, price: 3500 } });
  assert.equal(booking.statusCode, 201);
  assert.equal(booking.json().data.status, "pending");
  assert.equal(booking.json().data.price, 3500);
  const disabled = await inject({ method: "PATCH", url: `/api/v1/services/${service.id}`, headers: workspaceHeaders, payload: { active: false } });
  assert.equal(disabled.json().data.active, false);

  const overlap = await inject({ method: "POST", url: "/api/v1/appointments", headers: workspaceHeaders, payload: { customerName: "另一位客戶", service: "新服務", startsAt: "2030-01-15T10:30:00+08:00", durationMinutes: 30 } });
  assert.equal(overlap.statusCode, 409);
  const secondBooking = await inject({ method: "POST", url: "/api/v1/appointments", headers: workspaceHeaders, payload: { customerName: "第二位客戶", service: "回訪", startsAt: "2030-01-15T12:00:00+08:00", durationMinutes: 30 } });
  const rescheduleConflict = await inject({ method: "PATCH", url: `/api/v1/appointments/${secondBooking.json().data.id}`, headers: workspaceHeaders, payload: { startsAt: "2030-01-15T10:30:00+08:00" } });
  assert.equal(rescheduleConflict.statusCode, 409);
  const isolatedBooking = await inject({ method: "GET", url: "/api/v1/appointments", headers: otherWorkspaceHeaders });
  assert.deepEqual(isolatedBooking.json().data, []);

  const settings = await inject({ method: "PATCH", url: "/api/v1/workspace", headers: workspaceHeaders, payload: { name: "客製工作室", brandColor: "#123456", features: { reports: false, bookings: true } } });
  assert.equal(settings.json().data.name, "客製工作室");
  assert.equal(settings.json().data.features.reports, false);
  assert.equal(settings.json().data.features.customers, true);

  const report = await inject({ method: "GET", url: "/api/v1/reports?from=2030-01-01&to=2030-02-01", headers: workspaceHeaders });
  assert.equal(report.json().data.totalAppointments, 2);
  assert.equal(report.json().data.revenue, 0);
  assert.equal(report.json().data.byService[0].count, 1);

  const protectedDelete = await inject({ method: "DELETE", url: `/api/v1/customers/${customer.id}`, headers: workspaceHeaders });
  assert.equal(protectedDelete.statusCode, 409);
  const absentInOtherTenant = await inject({ method: "PATCH", url: `/api/v1/customers/${customer.id}`, headers: otherWorkspaceHeaders, payload: { name: "越權修改" } });
  assert.equal(absentInOtherTenant.statusCode, 404);
});

test("file repository restores workspace records after restart", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "bookwise-api-test-"));
  const filePath = join(directory, "bookwise.json");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const firstApp = buildApp([], new MemoryBookingRepository([], filePath));
  const firstClient = await demoClient(firstApp, "persistent-workspace");
  const created = await firstClient({ method: "POST", url: "/api/v1/customers", payload: { name: "跨重啟客戶", email: "persist@example.com" } });
  assert.equal(created.statusCode, 201);
  await firstApp.close();

  const secondApp = buildApp([], new MemoryBookingRepository([], filePath));
  t.after(() => secondApp.close());
  const secondClient = await demoClient(secondApp, "persistent-workspace");
  const restored = await secondClient({ method: "GET", url: "/api/v1/customers" });
  assert.equal(restored.json().data[0].name, "跨重啟客戶");
});

test("account authentication scopes users to their own workspace", async (t) => {
  const app = buildApp([]);
  t.after(() => app.close());
  const unauthenticated = await app.inject({ method: "GET", url: "/api/v1/customers" });
  assert.equal(unauthenticated.statusCode, 401);

  const registration = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { name: "新用戶", email: "OWNER@example.com", password: "secure-password-123", workspaceName: "新工作室" } });
  assert.equal(registration.statusCode, 201);
  const account = registration.json().data;
  assert.equal(account.user.email, "owner@example.com");
  const ownHeaders = { authorization: `Bearer ${account.token}` };
  const ownWorkspace = await app.inject({ method: "GET", url: "/api/v1/workspace", headers: ownHeaders });
  assert.equal(ownWorkspace.json().data.name, "新工作室");

  const crossTenant = await app.inject({ method: "GET", url: "/api/v1/customers", headers: { ...ownHeaders, "x-workspace-id": "demo-workspace" } });
  assert.equal(crossTenant.statusCode, 403);
  const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "owner@example.com", password: "secure-password-123" } });
  assert.equal(login.statusCode, 200);
  const badLogin = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "owner@example.com", password: "incorrect-password" } });
  assert.equal(badLogin.statusCode, 401);
  const duplicate = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { name: "重複用戶", email: "owner@example.com", password: "secure-password-123", workspaceName: "另一工作室" } });
  assert.equal(duplicate.statusCode, 409);
});

test("workspace owners can change their password and expire the old credentials", async (t) => {
  const app = buildApp([]);
  t.after(() => app.close());
  const registration = await app.inject({ method: "POST", url: "/api/v1/auth/register", payload: { name: "帳號主人", email: "password@example.com", password: "old-password-123", workspaceName: "我的空間" } });
  const session = registration.json().data;
  const headers = { authorization: `Bearer ${session.token}` };
  const changed = await app.inject({ method: "POST", url: "/api/v1/auth/password", headers, payload: { currentPassword: "old-password-123", newPassword: "new-password-456" } });
  assert.equal(changed.statusCode, 200);
  const oldToken = await app.inject({ method: "GET", url: "/api/v1/workspace", headers });
  assert.equal(oldToken.statusCode, 401);
  const oldPassword = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "password@example.com", password: "old-password-123" } });
  assert.equal(oldPassword.statusCode, 401);
  const newPassword = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: "password@example.com", password: "new-password-456" } });
  assert.equal(newPassword.statusCode, 200);
});
