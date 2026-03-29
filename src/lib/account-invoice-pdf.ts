import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "fs/promises";
import { join } from "path";

interface PropertyServices {
  bedrooms: number;
  photography: boolean;
  photoCount: number;
  dronePhotography: boolean;
  dronePhotoCount: 8 | 20;
  standardVideo: boolean;
  standardVideoDrone: boolean;
  agentPresentedVideo: boolean;
  agentPresentedVideoDrone: boolean;
  socialMediaVideo: boolean;
  socialMediaPresentedVideo: boolean;
  standardFloorPlan: boolean;
  premiumFloorPlan: boolean;
  floorPlan3D: boolean;
}

export interface AccountInvoiceData {
  invoiceId: string;
  client: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
  };
  bookings: Array<{
    address: string;
    postcode: string | null;
    bedrooms: number;
    preferredDate: string;
    startTime: string | null;
    endTime: string | null;
    services: string; // JSON string of PropertyServices
    total: number; // pence
  }>;
  totalAmount: number; // pence
  chargedAt: string; // ISO date
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

function generateAccountInvoiceNumber(invoiceId: string, chargedAt: string): string {
  const d = new Date(chargedAt);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const suffix = invoiceId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  return `TPR-ACC-${y}${mo}${day}-${suffix}`;
}

function parseServiceNames(servicesJson: string): string[] {
  let svc: Partial<PropertyServices>;
  try {
    svc = JSON.parse(servicesJson) as Partial<PropertyServices>;
  } catch {
    return [];
  }

  const names: string[] = [];

  if (svc.photography) {
    names.push(`Photography (${svc.photoCount ?? 0} photos)`);
  }
  if (svc.dronePhotography) {
    names.push(`Drone Photography (${svc.dronePhotoCount ?? 8} photos)`);
  }
  if (svc.standardVideo) {
    names.push("Standard Video");
  }
  if (svc.standardVideoDrone) {
    names.push("Standard Video with Drone");
  }
  if (svc.agentPresentedVideo) {
    names.push("Agent-Presented Video");
  }
  if (svc.agentPresentedVideoDrone) {
    names.push("Agent-Presented Video with Drone");
  }
  if (svc.socialMediaVideo) {
    names.push("Social Media Video");
  }
  if (svc.socialMediaPresentedVideo) {
    names.push("Social Media Presented Video");
  }
  if (svc.standardFloorPlan) {
    names.push("Standard Floor Plan");
  }
  if (svc.premiumFloorPlan) {
    names.push("Premium Floor Plan");
  }
  if (svc.floorPlan3D) {
    names.push("3D Floor Plan");
  }

  return names;
}

export async function generateAccountInvoicePdf(
  data: AccountInvoiceData
): Promise<Buffer> {
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

  // ─── Logo ───
  const logoPath = join(process.cwd(), "public", "logo.png");
  const logoBytes = await readFile(logoPath);
  const logoImage = await doc.embedPng(logoBytes);
  const logoAspect = logoImage.width / logoImage.height;
  const logoDisplayH = 28;
  const logoDisplayW = logoDisplayH * logoAspect;

  const invoiceNo = generateAccountInvoiceNumber(data.invoiceId, data.chargedAt);
  const invoiceDate = new Date(data.chargedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Helper: add a new page and return initial y
  function addPage() {
    const pg = doc.addPage([pageWidth, pageHeight]);
    return { pg, y: pageHeight - 50 };
  }

  let { pg: page, y } = addPage();

  // Draw logo on first page
  page.drawImage(logoImage, {
    x: ml,
    y: pageHeight - 50 - logoDisplayH,
    width: logoDisplayW,
    height: logoDisplayH,
  });

  // "INVOICE" right-aligned
  const invoiceLabel = "INVOICE";
  const invoiceLabelW = bold.widthOfTextAtSize(invoiceLabel, 18);
  page.drawText(invoiceLabel, {
    x: pageWidth - mr - invoiceLabelW,
    y: pageHeight - 50 - logoDisplayH + 8,
    size: 18,
    font: bold,
    color: black,
  });

  // Thin rule under logo
  y = pageHeight - 50 - logoDisplayH - 16;
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 24;

  // ─── Invoice meta ───
  const metaLeft = [
    { label: "Invoice No.", value: invoiceNo },
    { label: "Date", value: invoiceDate },
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

  page.drawText(data.client.companyName, {
    x: ml,
    y,
    size: 11,
    font: bold,
    color: black,
  });
  y -= 15;

  page.drawText(data.client.contactName, {
    x: ml,
    y,
    size: 9,
    font,
    color: black,
  });
  y -= 14;

  page.drawText(data.client.email, {
    x: ml,
    y,
    size: 9,
    font,
    color: black,
  });
  y -= 14;

  if (data.client.phone) {
    page.drawText(data.client.phone, {
      x: ml,
      y,
      size: 9,
      font,
      color: black,
    });
    y -= 14;
  }

  y -= 16;

  // ─── Booking sections ───
  for (const booking of data.bookings) {
    // Estimate height needed for this booking block
    const serviceNames = parseServiceNames(booking.services);
    // header(20) + datetime(18) + services(15 each) + subtotal rule + subtotal(8) + gap(24)
    const blockHeight = 20 + 18 + serviceNames.length * 15 + 14 + 8 + 24;

    // Page break if needed
    if (y - blockHeight < 120) {
      ({ pg: page, y } = addPage());
    }

    // Property header bar
    page.drawRectangle({ x: ml, y: y - 4, width: cw, height: 20, color: rgb(0.96, 0.94, 0.92) });

    const addr = `${booking.address}${booking.postcode ? `, ${booking.postcode}` : ""}`;
    page.drawText(addr, {
      x: ml + 8,
      y: y,
      size: 9,
      font: bold,
      color: black,
    });

    const beds = `${booking.bedrooms}-bed`;
    const bedsW = font.widthOfTextAtSize(beds, 8);
    page.drawText(beds, {
      x: pageWidth - mr - 8 - bedsW,
      y: y + 1,
      size: 8,
      font,
      color: muted,
    });

    y -= 20;

    // Date & time
    const timeStr =
      booking.startTime && booking.endTime
        ? `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`
        : booking.startTime
          ? formatTime(booking.startTime)
          : "";
    const dateTimeStr = `${formatDate(booking.preferredDate)}${timeStr ? `  ·  ${timeStr}` : ""}`;
    page.drawText(dateTimeStr, {
      x: ml + 8,
      y,
      size: 8,
      font,
      color: muted,
    });
    y -= 18;

    // Service lines (names only — amount on the last line, or show total for the booking)
    if (serviceNames.length > 0) {
      for (let i = 0; i < serviceNames.length; i++) {
        const isLast = i === serviceNames.length - 1;

        page.drawText(serviceNames[i], {
          x: ml + 8,
          y,
          size: 9,
          font,
          color: black,
        });

        // Show the booking total on the last service line
        if (isLast) {
          const amountStr = pence(booking.total);
          const amountW = font.widthOfTextAtSize(amountStr, 9);
          page.drawText(amountStr, {
            x: pageWidth - mr - 8 - amountW,
            y,
            size: 9,
            font,
            color: black,
          });
        }

        y -= 15;
      }
    } else {
      // No services parsed — just show amount
      const amountStr = pence(booking.total);
      const amountW = font.widthOfTextAtSize(amountStr, 9);
      page.drawText(amountStr, {
        x: pageWidth - mr - 8 - amountW,
        y,
        size: 9,
        font,
        color: black,
      });
      y -= 15;
    }

    // Booking subtotal rule
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

    const subStr = pence(booking.total);
    const subW = font.widthOfTextAtSize(subStr, 9);
    page.drawText(subStr, {
      x: pageWidth - mr - 8 - subW,
      y,
      size: 9,
      font,
      color: black,
    });

    y -= 24;
  }

  // ─── Totals section ───
  // Page break if needed before totals
  if (y < 160) {
    ({ pg: page, y } = addPage());
  }

  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 20;

  // Subtotal
  page.drawText("SUBTOTAL", {
    x: ml + 8,
    y,
    size: 8,
    font,
    color: muted,
  });

  const grandSubStr = pence(data.totalAmount);
  const grandSubW = font.widthOfTextAtSize(grandSubStr, 10);
  page.drawText(grandSubStr, {
    x: pageWidth - mr - 8 - grandSubW,
    y,
    size: 10,
    font,
    color: black,
  });
  y -= 18;

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

  page.drawText("TOTAL DUE", {
    x: ml + 10,
    y: y + 2,
    size: 10,
    font: bold,
    color: white,
  });

  const totalStr = pence(data.totalAmount);
  const totalW = bold.widthOfTextAtSize(totalStr, 14);
  page.drawText(totalStr, {
    x: pageWidth - mr - 10 - totalW,
    y: y,
    size: 14,
    font: bold,
    color: white,
  });

  y -= totalBarH + 10;

  // ─── Footer ───
  const footerY = 60;
  page.drawRectangle({ x: ml, y: footerY + 8, width: cw, height: 0.5, color: muted });

  page.drawText("harrison@thepropertyroom.co", {
    x: ml,
    y: footerY - 8,
    size: 8,
    font,
    color: muted,
  });

  const siteStr = "thepropertyroom.co";
  const siteW = font.widthOfTextAtSize(siteStr, 8);
  page.drawText(siteStr, {
    x: pageWidth - mr - siteW,
    y: footerY - 8,
    size: 8,
    font,
    color: muted,
  });

  page.drawText("Payment will be collected via Direct Debit.", {
    x: ml,
    y: footerY - 22,
    size: 8,
    font,
    color: muted,
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
