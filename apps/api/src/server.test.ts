import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "./server.js";

test("appointments API supports the main booking flow", async (t) => {
  const app = buildApp([]);
  t.after(() => app.close());

  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { status: "ok", service: "bookwise-api" });

  const invalid = await app.inject({
    method: "POST",
    url: "/api/v1/appointments",
    payload: { customerName: "", service: "諮詢", startsAt: "not-a-date", durationMinutes: 0 },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, "INVALID_INPUT");

  const created = await app.inject({
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

  const updated = await app.inject({
    method: "PATCH",
    url: `/api/v1/appointments/${appointment.id}`,
    payload: { status: "confirmed" },
  });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().data.status, "confirmed");

  const listed = await app.inject({ method: "GET", url: "/api/v1/appointments" });
  assert.equal(listed.json().data.length, 1);

  const deleted = await app.inject({ method: "DELETE", url: `/api/v1/appointments/${appointment.id}` });
  assert.equal(deleted.statusCode, 204);

  const missing = await app.inject({ method: "GET", url: "/api/v1/appointments" });
  assert.equal(missing.json().data.length, 0);
});
