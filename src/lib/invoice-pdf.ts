import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "fs/promises";
import { join } from "path";

interface ServiceLine {
  name: string;
  amount: number; // pence
}

interface PropertyInfo {
  address: string;
  postcode: string | null;
  bedrooms: number;
  preferredDate: string;
  startTime: string | null;
  endTime: string | null;
  services: ServiceLine[];
  subtotal: number; // pence
}

interface InvoiceData {
  agentName: string;
  agentCompany: string | null;
  agentEmail: string;
  agentPhone: string | null;
  properties: PropertyInfo[];
  discountCode: string | null;
  discountAmount: number; // pence total
  total: number; // pence
  stripeSession: string;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function generateInvoiceNumber(stripeSession: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = stripeSession.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase();
  return `TPR-${y}${m}${d}-${suffix}`;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const ml = 50; // margin left
  const mr = 50; // margin right
  const cw = width - ml - mr; // content width

  const black = rgb(0.04, 0.04, 0.04);
  const muted = rgb(0.54, 0.52, 0.5);
  const white = rgb(1, 1, 1);
  const green = rgb(0.1, 0.55, 0.1);

  let y = height - 50;
  const invoiceNo = generateInvoiceNumber(data.stripeSession);
  const invoiceDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // ─── Logo ───
  const logoPath = join(process.cwd(), "public", "logo.png");
  const logoBytes = await readFile(logoPath);
  const logoImage = await doc.embedPng(logoBytes);
  const logoAspect = logoImage.width / logoImage.height;
  const logoDisplayH = 28;
  const logoDisplayW = logoDisplayH * logoAspect;

  page.drawImage(logoImage, {
    x: ml,
    y: height - 50 - logoDisplayH,
    width: logoDisplayW,
    height: logoDisplayH,
  });

  // "INVOICE" right-aligned next to logo
  const invoiceLabel = "INVOICE";
  const invoiceLabelW = bold.widthOfTextAtSize(invoiceLabel, 18);
  page.drawText(invoiceLabel, {
    x: width - mr - invoiceLabelW,
    y: height - 50 - logoDisplayH + 8,
    size: 18,
    font: bold,
    color: black,
  });

  // Thin rule under logo
  y = height - 50 - logoDisplayH - 16;
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });

  y -= 24;

  // ─── Invoice meta ───
  const metaLeft = [
    { label: "Invoice No.", value: invoiceNo },
    { label: "Date", value: invoiceDate },
    { label: "Payment Ref", value: data.stripeSession.slice(0, 28) },
  ];

  for (const item of metaLeft) {
    page.drawText(item.label.toUpperCase(), {
      x: ml,
      y,
      size: 7,
      font,
      color: muted,
    });
    page.drawText(item.value, {
      x: ml + 80,
      y,
      size: 9,
      font,
      color: black,
    });
    y -= 16;
  }

  y -= 10;

  // ─── Thick rule ───
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 24;

  // ─── Bill to ───
  page.drawText("BILL TO", {
    x: ml,
    y,
    size: 7,
    font: bold,
    color: muted,
  });
  y -= 16;

  page.drawText(data.agentName, {
    x: ml,
    y,
    size: 11,
    font: bold,
    color: black,
  });
  y -= 15;

  if (data.agentCompany) {
    page.drawText(data.agentCompany, {
      x: ml,
      y,
      size: 9,
      font,
      color: black,
    });
    y -= 14;
  }

  page.drawText(data.agentEmail, {
    x: ml,
    y,
    size: 9,
    font,
    color: black,
  });
  y -= 14;

  if (data.agentPhone) {
    page.drawText(data.agentPhone, {
      x: ml,
      y,
      size: 9,
      font,
      color: black,
    });
    y -= 14;
  }

  y -= 16;

  // ─── Property sections ───
  for (const prop of data.properties) {
    // Property header bar
    page.drawRectangle({ x: ml, y: y - 4, width: cw, height: 20, color: rgb(0.96, 0.94, 0.92) });

    const addr = `${prop.address}${prop.postcode ? `, ${prop.postcode}` : ""}`;
    page.drawText(addr, {
      x: ml + 8,
      y: y,
      size: 9,
      font: bold,
      color: black,
    });

    const beds = `${prop.bedrooms}-bed`;
    const bedsW = font.widthOfTextAtSize(beds, 8);
    page.drawText(beds, {
      x: width - mr - 8 - bedsW,
      y: y + 1,
      size: 8,
      font,
      color: muted,
    });

    y -= 20;

    // Date & time
    const timeStr =
      prop.startTime && prop.endTime
        ? `${formatTime(prop.startTime)} – ${formatTime(prop.endTime)}`
        : prop.startTime
          ? formatTime(prop.startTime)
          : "";
    const dateTimeStr = `${formatDate(prop.preferredDate)}${timeStr ? `  ·  ${timeStr}` : ""}`;
    page.drawText(dateTimeStr, {
      x: ml + 8,
      y,
      size: 8,
      font,
      color: muted,
    });
    y -= 18;

    // Service lines
    for (const svc of prop.services) {
      page.drawText(svc.name, {
        x: ml + 8,
        y,
        size: 9,
        font,
        color: black,
      });

      const amountStr = pence(svc.amount);
      const amountW = font.widthOfTextAtSize(amountStr, 9);
      page.drawText(amountStr, {
        x: width - mr - 8 - amountW,
        y,
        size: 9,
        font,
        color: black,
      });

      y -= 15;
    }

    // Property subtotal
    page.drawRectangle({ x: ml, y: y + 6, width: cw, height: 0.5, color: muted });
    y -= 8;

    const subLabel = "Subtotal";
    page.drawText(subLabel, {
      x: ml + 8,
      y,
      size: 8,
      font,
      color: muted,
    });

    const subStr = pence(prop.subtotal);
    const subW = font.widthOfTextAtSize(subStr, 9);
    page.drawText(subStr, {
      x: width - mr - 8 - subW,
      y,
      size: 9,
      font,
      color: black,
    });

    y -= 24;
  }

  // ─── Totals section ───
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 20;

  const grandSubtotal = data.properties.reduce((s, p) => s + p.subtotal, 0);

  // Subtotal
  page.drawText("SUBTOTAL", {
    x: ml + 8,
    y,
    size: 8,
    font,
    color: muted,
  });

  const grandSubStr = pence(grandSubtotal);
  const grandSubW = font.widthOfTextAtSize(grandSubStr, 10);
  page.drawText(grandSubStr, {
    x: width - mr - 8 - grandSubW,
    y,
    size: 10,
    font,
    color: black,
  });
  y -= 18;

  // Discount
  if (data.discountAmount > 0) {
    const discLabel = `DISCOUNT${data.discountCode ? ` (${data.discountCode})` : ""}`;
    page.drawText(discLabel, {
      x: ml + 8,
      y,
      size: 8,
      font,
      color: muted,
    });

    const discStr = `-${pence(data.discountAmount)}`;
    const discW = font.widthOfTextAtSize(discStr, 10);
    page.drawText(discStr, {
      x: width - mr - 8 - discW,
      y,
      size: 10,
      font,
      color: green,
    });
    y -= 18;
  }

  // Total bar
  y -= 12;
  const totalBarH = 32;
  page.drawRectangle({
    x: ml,
    y: y - 8,
    width: cw,
    height: totalBarH,
    color: black,
  });

  page.drawText("TOTAL PAID", {
    x: ml + 10,
    y: y + 2,
    size: 10,
    font: bold,
    color: white,
  });

  const totalStr = pence(data.total);
  const totalW = bold.widthOfTextAtSize(totalStr, 14);
  page.drawText(totalStr, {
    x: width - mr - 10 - totalW,
    y: y,
    size: 14,
    font: bold,
    color: white,
  });

  y -= totalBarH + 10;

  // ─── Footer ───
  y = 60;
  page.drawRectangle({ x: ml, y: y + 8, width: cw, height: 0.5, color: muted });

  page.drawText("harrison@thepropertyroom.co", {
    x: ml,
    y: y - 8,
    size: 8,
    font,
    color: muted,
  });

  const siteStr = "thepropertyroom.co";
  const siteW = font.widthOfTextAtSize(siteStr, 8);
  page.drawText(siteStr, {
    x: width - mr - siteW,
    y: y - 8,
    size: 8,
    font,
    color: muted,
  });

  page.drawText("Thank you for your booking.", {
    x: ml,
    y: y - 22,
    size: 8,
    font,
    color: muted,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
