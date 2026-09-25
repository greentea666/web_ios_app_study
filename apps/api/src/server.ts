import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { apiResponse, createAppointmentSchema, type Appointment, type Dashboard } from "@bookwise/shared";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(helmet);
const appointments: Appointment[] = [
  { id: "apt_001", customerName: "林怡君", service: "初次諮詢", startsAt: "2026-09-25T10:00:00+08:00", durationMinutes: 60, status: "confirmed" },
  { id: "apt_002", customerName: "陳柏翰", service: "品牌策略工作坊", startsAt: "2026-09-25T13:30:00+08:00", durationMinutes: 90, status: "pending" },
  { id: "apt_003", customerName: "王思妤", service: "回訪會議", startsAt: "2026-09-25T15:30:00+08:00", durationMinutes: 45, status: "confirmed" },
];
app.get("/health", async () => ({ status: "ok", service: "bookwise-api" }));
app.get("/api/v1/dashboard", async (): Promise<{ data: Dashboard }> => apiResponse({
  businessName: "光嶼顧問工作室", todayAppointments: appointments.length,
  monthlyRevenue: 128400, occupancyRate: 78, appointments,
}));
app.get("/api/v1/appointments", async () => apiResponse(appointments));
app.post("/api/v1/appointments", async (request, reply) => {
  const parsed = createAppointmentSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "INVALID_INPUT", details: parsed.error.flatten() });
  const appointment: Appointment = { id: `apt_${Date.now()}`, ...parsed.data };
  appointments.push(appointment);
  return reply.code(201).send(apiResponse(appointment));
});
const port = Number(process.env.API_PORT ?? 4000);
app.listen({ port, host: "0.0.0.0" }).catch((error) => { app.log.error(error); process.exit(1); });