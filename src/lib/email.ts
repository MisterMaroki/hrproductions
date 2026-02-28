import { Resend } from "resend";

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

function buildInvoiceHtml(data: InvoiceData): string {
  const grandSubtotal = data.properties.reduce((s, p) => s + p.subtotal, 0);

  const propertyRows = data.properties
    .map((p) => {
      const serviceRows = p.services
        .map(
          (s) => `
            <tr>
              <td style="padding:6px 0;color:#333;font-size:14px;">${s.name}</td>
              <td style="padding:6px 0;color:#333;font-size:14px;text-align:right;">${pence(s.amount)}</td>
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
        <div style="margin-bottom:24px;">
          <h3 style="margin:0 0 4px;font-size:16px;color:#0a0a0a;">${p.address}${p.postcode ? `, ${p.postcode}` : ""}</h3>
          <p style="margin:0 0 12px;font-size:13px;color:#8a8580;">
            ${formatDate(p.preferredDate)}${timeStr ? ` · ${timeStr}` : ""} · ${p.bedrooms}-bed
          </p>
          <table style="width:100%;border-collapse:collapse;">
            ${serviceRows}
          </table>
        </div>`;
    })
    .join("");

  const discountRow =
    data.discountAmount > 0
      ? `<tr>
          <td style="padding:6px 0;color:#333;font-size:14px;">Discount${data.discountCode ? ` (${data.discountCode})` : ""}</td>
          <td style="padding:6px 0;color:#2a9d2a;font-size:14px;text-align:right;">-${pence(data.discountAmount)}</td>
        </tr>`
      : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">

    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#0a0a0a;letter-spacing:-0.01em;">The Property Room</h1>
      <p style="margin:4px 0 0;font-size:13px;color:#8a8580;letter-spacing:0.1em;text-transform:uppercase;">Booking Confirmation</p>
    </div>

    <div style="background:#ffffff;border-radius:6px;padding:28px 24px;border:1px solid #e8e4df;">

      <p style="margin:0 0 20px;font-size:14px;color:#333;">Hi ${data.agentName},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#333;line-height:1.6;">
        Thank you for your booking. Here's your confirmation and invoice.
      </p>

      <hr style="border:none;border-top:1px solid #e8e4df;margin:0 0 20px;" />

      ${propertyRows}

      <hr style="border:none;border-top:1px solid #e8e4df;margin:16px 0;" />

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#8a8580;font-size:14px;">Subtotal</td>
          <td style="padding:6px 0;color:#333;font-size:14px;text-align:right;">${pence(grandSubtotal)}</td>
        </tr>
        ${discountRow}
        <tr>
          <td style="padding:10px 0 0;color:#0a0a0a;font-size:16px;font-weight:700;">Total Paid</td>
          <td style="padding:10px 0 0;color:#0a0a0a;font-size:16px;font-weight:700;text-align:right;">${pence(data.total)}</td>
        </tr>
      </table>

    </div>

    <div style="text-align:center;margin-top:28px;">
      <p style="margin:0;font-size:13px;color:#8a8580;line-height:1.6;">
        If you have any questions, just reply to this email.<br/>
        We look forward to the shoot!
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
  const invoiceHtml = buildInvoiceHtml(data);
  const notificationHtml = buildNotificationHtml(data);

  await Promise.allSettled([
    // Invoice to the customer
    resend.emails.send({
      from: FROM,
      to: data.agentEmail,
      subject: `Booking Confirmed — The Property Room`,
      html: invoiceHtml,
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
