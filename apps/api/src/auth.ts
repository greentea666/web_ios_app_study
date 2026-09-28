import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12, "密碼至少需要 12 個字元").max(200),
  workspaceName: z.string().trim().min(1).max(100),
});
export const loginSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(1).max(200) });

type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | "DEMO";
type Account = { id: string; name: string; email: string; passwordHash: string; tokenVersion?: number; workspaceId: string; role: Exclude<Role, "DEMO"> };
export type Claims = { sub: string; name: string; email: string; workspaceId: string; role: Role; exp: number; ver?: number };

type AccountFile = { users: Account[] };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const decode = <T,>(value: string) => JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;

export class AuthService {
  private readonly users: Account[] = [];
  private readonly filePath?: string;
  private readonly secret: string;

  constructor() {
    const configuredSecret = process.env.AUTH_SECRET;
    if (process.env.NODE_ENV === "production" && (!configuredSecret || configuredSecret.length < 32)) throw new Error("AUTH_SECRET must be configured with at least 32 random characters in production.");
    this.secret = configuredSecret ?? "bookwise-local-development-only-not-for-production";
    this.filePath = process.env.NODE_ENV === "test" ? undefined : process.env.BOOKWISE_AUTH_FILE;
    if (this.filePath) {
      try {
        const data = JSON.parse(readFileSync(this.filePath, "utf8")) as AccountFile;
        this.users.push(...data.users);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        this.persist();
      }
    }
  }

  async register(input: z.infer<typeof registerSchema>) {
    if (this.users.some((user) => user.email === input.email)) return undefined;
    const workspaceId = `ws_${randomUUID().replaceAll("-", "")}`;
    const user: Account = {
      id: `usr_${randomUUID()}`, name: input.name, email: input.email,
      passwordHash: this.hash(input.password), workspaceId, role: "OWNER",
    };
    this.users.push(user);
    this.persist();
    return { token: this.sign(user), user: this.publicUser(user), workspaceId };
  }

  async login(input: z.infer<typeof loginSchema>) {
    const user = this.users.find((item) => item.email === input.email);
    if (!user || !this.verifyPassword(input.password, user.passwordHash)) return undefined;
    return { token: this.sign(user), user: this.publicUser(user), workspaceId: user.workspaceId };
  }

  changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = this.users.find((item) => item.id === userId);
    if (!user || !this.verifyPassword(currentPassword, user.passwordHash)) return false;
    user.passwordHash = this.hash(newPassword);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    this.persist();
    return true;
  }

  demoSession(): { token: string; user: { id: string; name: string; email: string; role: Role }; workspaceId: string } {
    const claims: Claims = { sub: "demo-owner", name: "Bookwise Demo", email: "demo@bookwise.local", workspaceId: "demo-workspace", role: "DEMO", exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 };
    return { token: this.encodeToken(claims), user: { id: claims.sub, name: claims.name, email: claims.email, role: claims.role }, workspaceId: claims.workspaceId };
  }

  verifyToken(token: string): Claims | undefined {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return undefined;
    const expected = createHmac("sha256", this.secret).update(payload).digest();
    let actual: Buffer;
    try { actual = Buffer.from(signature, "base64url"); } catch { return undefined; }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return undefined;
    try {
      const claims = decode<Claims>(payload);
      if (!claims.sub || !claims.workspaceId || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) return undefined;
      if (claims.role !== "DEMO") {
        const user = this.users.find((item) => item.id === claims.sub);
        if (!user || (claims.exp <= Math.floor(Date.now() / 1000)) || claims.role !== user.role || !claims.email) return undefined;
        const versionMatch = this.tokenVersionFromPayload(payload);
        if (versionMatch !== (user.tokenVersion ?? 0)) return undefined;
      }
      return claims;
    } catch { return undefined; }
  }

  issueDemoWorkspaceToken(workspaceId: string): string {
    return this.encodeToken({ sub: "demo-owner", name: "Bookwise Demo", email: "demo@bookwise.local", workspaceId, role: "DEMO", exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 } satisfies Claims);
  }

  private publicUser(user: Account) { return { id: user.id, name: user.name, email: user.email, role: user.role }; }
  private sign(user: Account) {
    return this.encodeToken({ sub: user.id, name: user.name, email: user.email, workspaceId: user.workspaceId, role: user.role, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60, ver: user.tokenVersion ?? 0 });
  }
  private tokenVersionFromPayload(payload: string) {
    try { return (decode<Claims & { ver?: number }>(payload).ver ?? 0); } catch { return -1; }
  }
  private encodeToken(claims: Claims) {
    const payload = encode(claims);
    const signature = createHmac("sha256", this.secret).update(payload).digest("base64url");
    return `${payload}.${signature}`;
  }
  private hash(password: string) {
    const salt = randomBytes(16).toString("hex");
    return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
  }
  private verifyPassword(password: string, value: string) {
    const [salt, hash] = value.split(":");
    if (!salt || !hash) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  private persist() {
    if (!this.filePath) return;
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify({ users: this.users }, null, 2), { mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
  }
}
