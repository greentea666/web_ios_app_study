import { Prisma, PrismaClient } from "../generated/client/index.js";
import type { Appointment, Customer, Service, Workspace } from "@bookwise/shared";
import type { BookingRepository } from "./server.js";
import type { AccountStore } from "./auth.js";

export class PrismaAccountStore implements AccountStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(account: { id: string; name: string; email: string; passwordHash: string; tokenVersion?: number; workspaceId: string; role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" }) {
    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.workspace.create({
          data: {
            id: account.workspaceId,
            slug: account.workspaceId,
            name: account.name,
            memberships: { create: { role: account.role, user: { create: { id: account.id, name: account.name, email: account.email, passwordHash: account.passwordHash, tokenVersion: account.tokenVersion ?? 0 } } } },
          },
        });
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
      throw error;
    }
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { memberships: true } });
    const membership = user?.memberships[0];
    if (!user || !membership) return undefined;
    return { id: user.id, name: user.name, email: user.email, passwordHash: user.passwordHash, tokenVersion: user.tokenVersion, workspaceId: membership.workspaceId, role: membership.role };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { memberships: true } });
    const membership = user?.memberships[0];
    if (!user || !membership) return undefined;
    return { id: user.id, name: user.name, email: user.email, passwordHash: user.passwordHash, tokenVersion: user.tokenVersion, workspaceId: membership.workspaceId, role: membership.role };
  }

  async updatePassword(id: string, passwordHash: string, tokenVersion: number) {
    await this.prisma.user.update({ where: { id }, data: { passwordHash, tokenVersion } });
    return true;
  }
}

const statusToDatabase = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  cancelled: "CANCELLED",
  completed: "COMPLETED",
} as const;
const statusFromDatabase = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
} as const;

const toWorkspace = (record: Prisma.WorkspaceGetPayload<object>): Workspace => ({
  id: record.id,
  name: record.name,
  timezone: record.timezone,
  currency: record.currency,
  locale: record.locale,
  brandColor: record.brandColor,
  features: record.features as Workspace["features"],
});

const toCustomer = (record: Prisma.CustomerGetPayload<object>): Customer => ({
  id: record.id,
  name: record.name,
  email: record.email,
  phone: record.phone,
  notes: record.notes,
  tags: record.tags,
  createdAt: record.createdAt.toISOString(),
});

const toService = (record: Prisma.ServiceGetPayload<object>): Service => ({
  id: record.id,
  name: record.name,
  description: record.description,
  durationMinutes: record.durationMinutes,
  price: Number(record.price),
  currency: record.currency,
  active: record.active,
  color: record.color,
});

const toAppointment = (record: Prisma.AppointmentGetPayload<object>): Appointment => ({
  id: record.id,
  customerId: record.customerId ?? undefined,
  serviceId: record.serviceId ?? undefined,
  customerName: record.customerName,
  service: record.serviceName,
  startsAt: record.startsAt.toISOString(),
  durationMinutes: record.durationMinutes,
  status: statusFromDatabase[record.status],
  price: Number(record.price),
  notes: record.notes,
  createdAt: record.createdAt.toISOString(),
});

export class PrismaBookingRepository implements BookingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async appointments(workspaceId: string) {
    const records = await this.prisma.appointment.findMany({ where: { workspaceId } });
    return records.map(toAppointment);
  }

  async customers(workspaceId: string) {
    const records = await this.prisma.customer.findMany({ where: { workspaceId } });
    return records.map(toCustomer);
  }

  async services(workspaceId: string) {
    const records = await this.prisma.service.findMany({ where: { workspaceId } });
    return records.map(toService);
  }

  async workspace(workspaceId: string) {
    const record = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!record) throw new Error(`Workspace not found: ${workspaceId}`);
    return toWorkspace(record);
  }

  async putAppointment(workspaceId: string, value: Appointment) {
    await this.prisma.appointment.create({
      data: {
        id: value.id,
        workspaceId,
        customerId: value.customerId ?? null,
        serviceId: value.serviceId ?? null,
        customerName: value.customerName,
        serviceName: value.service,
        startsAt: new Date(value.startsAt),
        durationMinutes: value.durationMinutes,
        status: statusToDatabase[value.status],
        price: value.price,
        notes: value.notes,
        ...(value.createdAt ? { createdAt: new Date(value.createdAt) } : {}),
      },
    });
  }

  async putCustomer(workspaceId: string, value: Customer) {
    await this.prisma.customer.create({
      data: {
        id: value.id,
        workspaceId,
        name: value.name,
        email: value.email,
        phone: value.phone,
        notes: value.notes,
        tags: value.tags,
        ...(value.createdAt ? { createdAt: new Date(value.createdAt) } : {}),
      },
    });
  }

  async putService(workspaceId: string, value: Service) {
    await this.prisma.service.create({
      data: {
        id: value.id,
        workspaceId,
        name: value.name,
        description: value.description,
        durationMinutes: value.durationMinutes,
        price: value.price,
        currency: value.currency,
        active: value.active,
        color: value.color,
      },
    });
  }

  async putWorkspace(value: Workspace) {
    const features = value.features as Prisma.InputJsonValue;
    await this.prisma.workspace.upsert({
      where: { id: value.id },
      create: {
        id: value.id,
        slug: value.id,
        name: value.name,
        timezone: value.timezone,
        currency: value.currency,
        locale: value.locale,
        brandColor: value.brandColor,
        features,
      },
      update: {
        name: value.name,
        timezone: value.timezone,
        currency: value.currency,
        locale: value.locale,
        brandColor: value.brandColor,
        features,
      },
    });
  }

  async updateAppointment(workspaceId: string, id: string, changes: Partial<Appointment>) {
    const data: Prisma.AppointmentUpdateInput = {};
    if (changes.customerId !== undefined) data.customer = { connect: { id: changes.customerId } };
    if (changes.serviceId !== undefined) data.serviceRecord = { connect: { id: changes.serviceId } };
    if (changes.customerName !== undefined) data.customerName = changes.customerName;
    if (changes.service !== undefined) data.serviceName = changes.service;
    if (changes.startsAt !== undefined) data.startsAt = new Date(changes.startsAt);
    if (changes.durationMinutes !== undefined) data.durationMinutes = changes.durationMinutes;
    if (changes.status !== undefined) data.status = statusToDatabase[changes.status];
    if (changes.price !== undefined) data.price = changes.price;
    if (changes.notes !== undefined) data.notes = changes.notes;
    const record = await this.prisma.appointment.findFirst({ where: { id, workspaceId } });
    if (!record) return undefined;
    const updated = await this.prisma.appointment.update({ where: { id, workspaceId }, data });
    return toAppointment(updated);
  }

  async updateCustomer(workspaceId: string, id: string, changes: Partial<Customer>) {
    const data: Prisma.CustomerUpdateManyMutationInput = {};
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.email !== undefined) data.email = changes.email;
    if (changes.phone !== undefined) data.phone = changes.phone;
    if (changes.notes !== undefined) data.notes = changes.notes;
    if (changes.tags !== undefined) data.tags = changes.tags;
    const result = await this.prisma.customer.updateMany({ where: { id, workspaceId }, data });
    if (!result.count) return undefined;
    const record = await this.prisma.customer.findFirst({ where: { id, workspaceId } });
    return record ? toCustomer(record) : undefined;
  }

  async updateService(workspaceId: string, id: string, changes: Partial<Service>) {
    const data: Prisma.ServiceUpdateManyMutationInput = {};
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.description !== undefined) data.description = changes.description;
    if (changes.durationMinutes !== undefined) data.durationMinutes = changes.durationMinutes;
    if (changes.price !== undefined) data.price = changes.price;
    if (changes.currency !== undefined) data.currency = changes.currency;
    if (changes.active !== undefined) data.active = changes.active;
    if (changes.color !== undefined) data.color = changes.color;
    const result = await this.prisma.service.updateMany({ where: { id, workspaceId }, data });
    if (!result.count) return undefined;
    const record = await this.prisma.service.findFirst({ where: { id, workspaceId } });
    return record ? toService(record) : undefined;
  }

  async deleteAppointment(workspaceId: string, id: string) {
    const result = await this.prisma.appointment.deleteMany({ where: { id, workspaceId } });
    return result.count > 0;
  }

  async deleteCustomer(workspaceId: string, id: string) {
    const result = await this.prisma.customer.deleteMany({ where: { id, workspaceId } });
    return result.count > 0;
  }

  async deleteService(workspaceId: string, id: string) {
    const result = await this.prisma.service.deleteMany({ where: { id, workspaceId } });
    return result.count > 0;
  }
}
