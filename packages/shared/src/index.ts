import { z } from "zod";

export const appointmentStatusSchema = z.enum(["confirmed", "pending", "cancelled"]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;
export const appointmentSchema = z.object({
  id: z.string(), customerName: z.string(), service: z.string(), startsAt: z.string(),
  durationMinutes: z.number().int().positive(), status: appointmentStatusSchema,
});
export type Appointment = z.infer<typeof appointmentSchema>;
export const createAppointmentSchema = z.object({
  customerName: z.string().trim().min(1, "請輸入客戶姓名").max(80),
  service: z.string().trim().min(1, "請輸入服務名稱").max(120),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive().max(480),
  status: appointmentStatusSchema.default("pending"),
});
export type CreateAppointment = z.infer<typeof createAppointmentSchema>;
export const updateAppointmentSchema = z.object({ status: appointmentStatusSchema });
export type UpdateAppointment = z.infer<typeof updateAppointmentSchema>;
export const dashboardSchema = z.object({
  businessName: z.string(), todayAppointments: z.number(), monthlyRevenue: z.number(),
  occupancyRate: z.number(), appointments: z.array(appointmentSchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export const apiResponse = <T>(data: T) => ({ data, meta: { version: "v1" } });