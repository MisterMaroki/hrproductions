import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getClientSession, verifyPassword, hashPassword } from "@/lib/client-auth";

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new passwords are required" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const rows = await db
    .select({ passwordHash: clients.passwordHash })
    .from(clients)
    .where(eq(clients.id, session.sub))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const valid = await verifyPassword(currentPassword, rows[0].passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 401 }
    );
  }

  const newHash = await hashPassword(newPassword);
  await db.update(clients).set({ passwordHash: newHash }).where(eq(clients.id, session.sub));

  return NextResponse.json({ success: true });
}
