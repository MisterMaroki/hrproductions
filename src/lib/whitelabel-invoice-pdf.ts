import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface WhitelabelInvoiceData {
  invoiceNumber: string;
  generatedAt: string; // ISO
  billTo: {
    company: string;
    addressLines: string[];
    email?: string;
  };
  bookings: Array<{
    address: string;
    postcode: string | null;
    bedrooms: number;
    preferredDate: string;
    startTime: string | null;
    endTime: string | null;
    services: string; // JSON
    total: number; // pence
  }>;
  totalAmount: number; // pence
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function parseServiceNames(servicesJson: string): string[] {
  try {
    const parsed = JSON.parse(servicesJson);
    if (Array.isArray(parsed)) {
      return parsed.map((s: { serviceName?: string; serviceId?: string }) => s.serviceName || s.serviceId || "Service");
    }
  } catch {}
  return [];
}

export async function generateWhitelabelInvoicePdf(data: WhitelabelInvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const ml = 50;
  const mr = 50;
  const cw = pageWidth - ml - mr;

  const black = rgb(0.04, 0.04, 0.04);
  const muted = rgb(0.54, 0.52, 0.5);
  const white = rgb(1, 1, 1);

  function addPage() {
    const pg = doc.addPage([pageWidth, pageHeight]);
    return { pg, y: pageHeight - 50 };
  }

  let { pg: page, y } = addPage();

  // Title — no logo, no TPR branding
  page.drawText("INVOICE", { x: ml, y: pageHeight - 60, size: 22, font: bold, color: black });

  const invoiceDate = new Date(data.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  y = pageHeight - 90;
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 24;

  for (const item of [
    { label: "INVOICE NO.", value: data.invoiceNumber },
    { label: "DATE", value: invoiceDate },
  ]) {
    page.drawText(item.label, { x: ml, y, size: 7, font, color: muted });
    page.drawText(item.value, { x: ml + 90, y, size: 9, font, color: black });
    y -= 16;
  }

  y -= 10;
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 24;

  page.drawText("BILL TO", { x: ml, y, size: 7, font: bold, color: muted });
  y -= 16;
  page.drawText(data.billTo.company, { x: ml, y, size: 11, font: bold, color: black });
  y -= 15;
  for (const line of data.billTo.addressLines) {
    page.drawText(line, { x: ml, y, size: 9, font, color: black });
    y -= 14;
  }
  if (data.billTo.email) {
    page.drawText(data.billTo.email, { x: ml, y, size: 9, font, color: black });
    y -= 14;
  }
  y -= 16;

  for (const booking of data.bookings) {
    const serviceNames = parseServiceNames(booking.services);
    const blockHeight = 20 + 18 + serviceNames.length * 15 + 14 + 8 + 24;
    if (y - blockHeight < 120) ({ pg: page, y } = addPage());

    page.drawRectangle({ x: ml, y: y - 4, width: cw, height: 20, color: rgb(0.96, 0.94, 0.92) });
    const addr = `${booking.address}${booking.postcode ? `, ${booking.postcode}` : ""}`;
    page.drawText(addr, { x: ml + 8, y, size: 9, font: bold, color: black });

    const beds = `${booking.bedrooms}-bed`;
    const bedsW = font.widthOfTextAtSize(beds, 8);
    page.drawText(beds, { x: pageWidth - mr - 8 - bedsW, y: y + 1, size: 8, font, color: muted });
    y -= 20;

    const timeStr =
      booking.startTime && booking.endTime
        ? `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`
        : booking.startTime ? formatTime(booking.startTime) : "";
    const dateTimeStr = `${formatDate(booking.preferredDate)}${timeStr ? `  ·  ${timeStr}` : ""}`;
    page.drawText(dateTimeStr, { x: ml + 8, y, size: 8, font, color: muted });
    y -= 18;

    if (serviceNames.length > 0) {
      for (let i = 0; i < serviceNames.length; i++) {
        const isLast = i === serviceNames.length - 1;
        page.drawText(serviceNames[i], { x: ml + 8, y, size: 9, font, color: black });
        if (isLast) {
          const amountStr = pence(booking.total);
          const amountW = font.widthOfTextAtSize(amountStr, 9);
          page.drawText(amountStr, { x: pageWidth - mr - 8 - amountW, y, size: 9, font, color: black });
        }
        y -= 15;
      }
    } else {
      const amountStr = pence(booking.total);
      const amountW = font.widthOfTextAtSize(amountStr, 9);
      page.drawText(amountStr, { x: pageWidth - mr - 8 - amountW, y, size: 9, font, color: black });
      y -= 15;
    }

    page.drawRectangle({ x: ml, y: y + 6, width: cw, height: 0.5, color: muted });
    y -= 8;
    page.drawText("Subtotal", { x: ml + 8, y, size: 8, font, color: muted });
    const subStr = pence(booking.total);
    const subW = font.widthOfTextAtSize(subStr, 9);
    page.drawText(subStr, { x: pageWidth - mr - 8 - subW, y, size: 9, font, color: black });
    y -= 24;
  }

  if (y < 160) ({ pg: page, y } = addPage());
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 20;

  y -= 12;
  const totalBarH = 32;
  page.drawRectangle({ x: ml, y: y - 8, width: cw, height: totalBarH, color: black });
  page.drawText("TOTAL DUE", { x: ml + 10, y: y + 2, size: 10, font: bold, color: white });
  const totalStr = pence(data.totalAmount);
  const totalW = bold.widthOfTextAtSize(totalStr, 14);
  page.drawText(totalStr, { x: pageWidth - mr - 10 - totalW, y, size: 14, font: bold, color: white });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export function readBillToFromEnv(): { company: string; addressLines: string[]; email?: string } {
  const company = process.env.WHITELABEL_INVOICE_COMPANY || "Company Name";
  const linesRaw = process.env.WHITELABEL_INVOICE_ADDRESS_LINES || "";
  const addressLines = linesRaw
    .split(/\r?\n|\\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const email = process.env.WHITELABEL_INVOICE_EMAIL || undefined;
  return { company, addressLines, email };
}
