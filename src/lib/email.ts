import { Resend } from "resend";
import { generateInvoicePdf } from "./invoice-pdf";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Harrison <harrison@thepropertyroom.co>";
const HARRISON_EMAIL = "harrison@thepropertyroom.co";

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

function buildInvoiceHtml(data: InvoiceData): string {
  const invoiceNo = generateInvoiceNumber(data.stripeSession);
  const invoiceDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const grandSubtotal = data.properties.reduce((s, p) => s + p.subtotal, 0);

  const propertyBlocks = data.properties
    .map((p) => {
      const serviceRows = p.services
        .map(
          (s) => `
            <tr>
              <td style="padding:8px 0;color:#0a0a0a;font-size:14px;border-bottom:1px solid #e8e4df;">${s.name}</td>
              <td style="padding:8px 0;color:#0a0a0a;font-size:14px;text-align:right;border-bottom:1px solid #e8e4df;font-variant-numeric:tabular-nums;">${pence(s.amount)}</td>
            </tr>`
        )
        .join("");

      const timeStr =
        p.startTime && p.endTime
          ? `${formatTime(p.startTime)} – ${formatTime(p.endTime)}`
          : p.startTime
            ? formatTime(p.startTime)
            : "";

      return `
        <div style="margin-bottom:28px;">
          <div style="background:#0a0a0a;padding:10px 14px;margin-bottom:0;">
            <span style="color:#ffffff;font-size:14px;font-weight:700;letter-spacing:0.02em;">${p.address}${p.postcode ? `, ${p.postcode}` : ""}</span>
            <span style="color:#8a8580;font-size:12px;float:right;">${p.bedrooms}-bed</span>
          </div>
          <div style="background:#f5f0eb;padding:8px 14px;border:2px solid #0a0a0a;border-top:none;">
            <span style="font-size:12px;color:#8a8580;letter-spacing:0.03em;">${formatDate(p.preferredDate)}${timeStr ? ` · ${timeStr}` : ""}</span>
          </div>
          <table style="width:100%;border-collapse:collapse;border:2px solid #0a0a0a;border-top:none;">
            <tbody>
              ${serviceRows}
              <tr>
                <td style="padding:8px 0;color:#8a8580;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Subtotal</td>
                <td style="padding:8px 0;color:#0a0a0a;font-size:14px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;">${pence(p.subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>`;
    })
    .join("");

  const discountRow =
    data.discountAmount > 0
      ? `<tr>
          <td style="padding:8px 0;color:#8a8580;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Discount${data.discountCode ? ` (${data.discountCode})` : ""}</td>
          <td style="padding:8px 0;color:#1a7a1a;font-size:14px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;">-${pence(data.discountAmount)}</td>
        </tr>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="background:#0a0a0a;padding:24px 28px;margin-bottom:0;">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.04em;">THE PROPERTY ROOM</h1>
      <p style="margin:4px 0 0;font-size:9px;color:#8a8580;letter-spacing:0.2em;text-transform:uppercase;">Property Marketing &amp; Visual Media</p>
    </div>

    <!-- Invoice label bar -->
    <div style="background:#f5f0eb;border:2px solid #0a0a0a;border-top:none;padding:12px 28px;display:flex;">
      <table style="width:100%;">
        <tr>
          <td style="font-size:11px;color:#8a8580;text-transform:uppercase;letter-spacing:0.1em;">Invoice</td>
          <td style="text-align:right;font-size:11px;color:#0a0a0a;font-weight:700;">${invoiceNo}</td>
        </tr>
      </table>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:28px;border:2px solid #0a0a0a;border-top:none;">

      <!-- Meta -->
      <table style="width:100%;margin-bottom:24px;border-collapse:collapse;">
        <tr>
          <td style="padding:3px 0;font-size:11px;color:#8a8580;text-transform:uppercase;letter-spacing:0.05em;width:100px;">Date</td>
          <td style="padding:3px 0;font-size:13px;color:#0a0a0a;">${invoiceDate}</td>
        </tr>
      </table>

      <!-- Bill to -->
      <div style="margin-bottom:28px;">
        <p style="margin:0 0 8px;font-size:9px;color:#8a8580;text-transform:uppercase;letter-spacing:0.15em;font-weight:700;">Bill To</p>
        <p style="margin:0;font-size:14px;color:#0a0a0a;font-weight:700;">${data.agentName}</p>
        ${data.agentCompany ? `<p style="margin:2px 0 0;font-size:13px;color:#0a0a0a;">${data.agentCompany}</p>` : ""}
        <p style="margin:2px 0 0;font-size:13px;color:#8a8580;">${data.agentEmail}</p>
        ${data.agentPhone ? `<p style="margin:2px 0 0;font-size:13px;color:#8a8580;">${data.agentPhone}</p>` : ""}
      </div>

      <!-- Properties -->
      ${propertyBlocks}

      <!-- Grand totals -->
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <tr>
          <td style="padding:8px 0;color:#8a8580;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;border-top:2px solid #0a0a0a;">Subtotal</td>
          <td style="padding:8px 0;color:#0a0a0a;font-size:14px;text-align:right;border-top:2px solid #0a0a0a;font-variant-numeric:tabular-nums;">${pence(grandSubtotal)}</td>
        </tr>
        ${discountRow}
      </table>

      <!-- Total bar -->
      <div style="background:#0a0a0a;padding:14px 16px;margin-top:4px;">
        <table style="width:100%;">
          <tr>
            <td style="color:#ffffff;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Total Paid</td>
            <td style="color:#ffffff;font-size:18px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums;">${pence(data.total)}</td>
          </tr>
        </table>
      </div>

    </div>

    <!-- Footer -->
    <div style="padding:20px 0;text-align:center;">
      <p style="margin:0;font-size:12px;color:#8a8580;line-height:1.8;">
        Your invoice is attached as a PDF.<br/>
        Questions? Reply to this email.
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildNotificationHtml(data: InvoiceData): string {
  const props = data.properties
    .map((p) => {
      const services = p.services.map((s) => s.name).join(", ");
      const timeStr =
        p.startTime && p.endTime
          ? `${formatTime(p.startTime)} – ${formatTime(p.endTime)}`
          : "";
      return `<li style="margin-bottom:8px;"><strong>${p.address}</strong> — ${formatDate(p.preferredDate)}${timeStr ? ` (${timeStr})` : ""} — ${services}</li>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <h2 style="margin:0 0 16px;">New Booking — ${pence(data.total)}</h2>
  <p><strong>Agent:</strong> ${data.agentName}${data.agentCompany ? ` (${data.agentCompany})` : ""}</p>
  <p><strong>Email:</strong> ${data.agentEmail}</p>
  ${data.agentPhone ? `<p><strong>Phone:</strong> ${data.agentPhone}</p>` : ""}
  <h3 style="margin:20px 0 8px;">Properties</h3>
  <ul>${props}</ul>
  ${data.discountCode ? `<p><strong>Discount:</strong> ${data.discountCode} (−${pence(data.discountAmount)})</p>` : ""}
</body>
</html>`;
}

export async function sendBookingEmails(data: InvoiceData) {
  const invoiceNo = generateInvoiceNumber(data.stripeSession);
  const invoiceHtml = buildInvoiceHtml(data);
  const notificationHtml = buildNotificationHtml(data);

  // Generate PDF invoice
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateInvoicePdf(data);
  } catch (e) {
    console.error("Failed to generate invoice PDF:", e);
  }

  await Promise.allSettled([
    // Invoice to the customer
    resend.emails.send({
      from: FROM,
      to: data.agentEmail,
      subject: `Invoice ${invoiceNo} — The Property Room`,
      html: invoiceHtml,
      ...(pdfBuffer
        ? {
            attachments: [
              {
                filename: `${invoiceNo}.pdf`,
                content: pdfBuffer,
              },
            ],
          }
        : {}),
    }),

    // Notification to Harrison
    resend.emails.send({
      from: FROM,
      to: HARRISON_EMAIL,
      subject: `New Booking: ${data.properties.map((p) => p.address).join(", ")}`,
      html: notificationHtml,
    }),
  ]);
}
