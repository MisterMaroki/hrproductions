import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";
import { readFile } from "fs/promises";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.clientId, session.sub)))
    .limit(1);

  if (rows.length === 0 || !rows[0].pdfPath) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const pdfBuffer = await readFile(rows[0].pdfPath);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${id}.pdf"`,
    },
  });
}
