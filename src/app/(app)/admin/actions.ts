// Admin server actions for user management
// Handles ban, unban, promote, demote, delete operations

"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, adminLogs, accounts, repositories, dailyStats, repoStats } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.isAdmin) throw new Error("forbidden");
  return user;
}

async function logAction(adminId: string, action: string, targetId: string | null, details: string) {
  await db.insert(adminLogs).values({ adminId, action, targetId, details });
}

export async function banUser(formData: FormData) {
  const admin = await requireAdmin();
  const targetId = formData.get("userId") as string;
  const reason = (formData.get("reason") as string) || "No reason provided";

  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) return;
  if (target.isAdmin) return;

  await db.update(users).set({ isBanned: true, banReason: reason }).where(eq(users.id, targetId));
  await logAction(admin.id, "ban_user", targetId, `Banned ${target.username}: ${reason}`);
  revalidatePath("/admin/users");
}

export async function unbanUser(formData: FormData) {
  const admin = await requireAdmin();
  const targetId = formData.get("userId") as string;

  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) return;

  await db.update(users).set({ isBanned: false, banReason: null }).where(eq(users.id, targetId));
  await logAction(admin.id, "unban_user", targetId, `Unbanned ${target.username}`);
  revalidatePath("/admin/users");
}

export async function promoteUser(formData: FormData) {
  const admin = await requireAdmin();
  const targetId = formData.get("userId") as string;

  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) return;

  await db.update(users).set({ isAdmin: true }).where(eq(users.id, targetId));
  await logAction(admin.id, "promote_admin", targetId, `Promoted ${target.username} to admin`);
  revalidatePath("/admin/users");
}

export async function demoteUser(formData: FormData) {
  const admin = await requireAdmin();
  const targetId = formData.get("userId") as string;

  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target || target.id === admin.id) return;

  await db.update(users).set({ isAdmin: false }).where(eq(users.id, targetId));
  await logAction(admin.id, "demote_admin", targetId, `Demoted ${target.username} from admin`);
  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const admin = await requireAdmin();
  const targetId = formData.get("userId") as string;

  const [target] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!target || target.id === admin.id) return;

  await db.delete(users).where(eq(users.id, targetId));
  await logAction(admin.id, "delete_user", targetId, `Deleted ${target.username}`);
  revalidatePath("/admin/users");
}

export async function grantAdminByUsername(formData: FormData) {
  const admin = await requireAdmin();
  const username = (formData.get("username") as string)?.trim();
  if (!username) return;

  const [target] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!target) return;

  await db.update(users).set({ isAdmin: true }).where(eq(users.id, target.id));
  await logAction(admin.id, "grant_admin", target.id, `Granted admin to ${username}`);
  revalidatePath("/admin/users");
}

export async function revokeAdminByUsername(formData: FormData) {
  const admin = await requireAdmin();
  const username = (formData.get("username") as string)?.trim();
  if (!username) return;

  const [target] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!target || target.id === admin.id) return;

  await db.update(users).set({ isAdmin: false }).where(eq(users.id, target.id));
  await logAction(admin.id, "revoke_admin", target.id, `Revoked admin from ${username}`);
  revalidatePath("/admin/users");
}
