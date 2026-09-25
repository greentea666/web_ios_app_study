import { z } from "zod";

export const appointmentStatusSchema = z.enum(["confirmed", "pending", "cancelled"]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;
export const appointmentSchema = z.object({
  id: z.string(), customerName: z.string(), service: z.string(), startsAt: z.string(),
  durationMinutes: z.number(), status: appointmentStatusSchema,
});
export type Appointment = z.infer<typeof appointmentSchema>;
export const createAppointmentSchema = appointmentSchema.omit({ id: true });
export type CreateAppointment = z.infer<typeof createAppointmentSchema>;
export const dashboardSchema = z.object({
  businessName: z.string(), todayAppointments: z.number(), monthlyRevenue: z.number(),
  occupancyRate: z.number(), appointments: z.array(appointmentSchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export const apiResponse = <T>(data: T) => ({ data, meta: { version: "v1" } });