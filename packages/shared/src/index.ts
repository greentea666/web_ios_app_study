import { z } from "zod";

export const appointmentStatusSchema = z.enum(["confirmed", "pending", "cancelled", "completed"]);
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

export const appointmentSchema = z.object({
  id: z.string(), customerName: z.string(), service: z.string(), startsAt: z.string(),
  durationMinutes: z.number().int().positive(), status: appointmentStatusSchema,
  customerId: z.string().optional(), serviceId: z.string().optional(), price: z.number().nonnegative().default(0),
  notes: z.string().default(""), createdAt: z.string().optional(),
});
export type Appointment = z.infer<typeof appointmentSchema>;
export const createAppointmentSchema = z.object({
  customerName: z.string().trim().min(1, "請輸入客戶姓名").max(80),
  service: z.string().trim().min(1, "請輸入服務名稱").max(120),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().positive().max(480),
  status: appointmentStatusSchema.default("pending"),
  customerId: z.string().optional(), serviceId: z.string().optional(),
  price: z.number().nonnegative().max(10_000_000).default(0), notes: z.string().max(2000).default(""),
});
export type CreateAppointment = z.infer<typeof createAppointmentSchema>;
export const updateAppointmentSchema = createAppointmentSchema.partial().refine((value) => Object.keys(value).length > 0, "至少提供一個要更新的欄位");
export type UpdateAppointment = z.infer<typeof updateAppointmentSchema>;

export const customerSchema = z.object({
  id: z.string(), name: z.string(), email: z.string().email().or(z.literal("")), phone: z.string(),
  notes: z.string(), tags: z.array(z.string()), createdAt: z.string(),
});
export type Customer = z.infer<typeof customerSchema>;
export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "請輸入客戶姓名").max(80),
  email: z.string().trim().email("Email 格式不正確").or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""), notes: z.string().max(2000).default(""),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
});
export type CreateCustomer = z.infer<typeof createCustomerSchema>;
export const updateCustomerSchema = createCustomerSchema.partial().refine((value) => Object.keys(value).length > 0, "至少提供一個要更新的欄位");

export const serviceSchema = z.object({
  id: z.string(), name: z.string(), description: z.string(), durationMinutes: z.number().int().positive(),
  price: z.number().nonnegative(), currency: z.string().length(3), active: z.boolean(), color: z.string(),
});
export type Service = z.infer<typeof serviceSchema>;
export const createServiceSchema = z.object({
  name: z.string().trim().min(1, "請輸入服務名稱").max(120), description: z.string().max(1000).default(""),
  durationMinutes: z.number().int().positive().max(480), price: z.number().nonnegative().max(10_000_000),
  currency: z.string().length(3).default("TWD"), active: z.boolean().default(true), color: z.string().regex(/^#[\da-fA-F]{6}$/).default("#27856f"),
});
export const updateServiceSchema = createServiceSchema.partial().refine((value) => Object.keys(value).length > 0, "至少提供一個要更新的欄位");

export const workspaceSchema = z.object({
  id: z.string(), name: z.string(), timezone: z.string(), currency: z.string().length(3), locale: z.string(),
  brandColor: z.string().regex(/^#[\da-fA-F]{6}$/), features: z.record(z.string(), z.boolean()),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export const updateWorkspaceSchema = workspaceSchema.omit({ id: true }).partial().refine((value) => Object.keys(value).length > 0, "至少提供一個要更新的欄位");

export const dashboardSchema = z.object({
  businessName: z.string(), todayAppointments: z.number(), monthlyRevenue: z.number(),
  occupancyRate: z.number(), appointments: z.array(appointmentSchema),
  pendingAppointments: z.number().default(0), customerCount: z.number().default(0), activeServiceCount: z.number().default(0),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
export const apiResponse = <T>(data: T) => ({ data, meta: { version: "v1" } });
