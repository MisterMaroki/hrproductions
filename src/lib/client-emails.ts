import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Harrison <harrison@thepropertyroom.co>";

interface BookingCancelledData {
  contactName: string;
  email: string;
  address: string;
  postcode: string | null;
  preferredDate: string;
}

export async function sendBookingCancelledEmail(data: BookingCancelledData) {
  const date = new Date(data.preferredDate + "T12:00:00").toLocaleDateString(
    "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  );

  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Booking Cancelled: ${data.address} — The Property Room`,
    html: `
      <h2>Booking Cancelled</h2>
      <p>Hi ${data.contactName},</p>
      <p>The following booking has been cancelled:</p>
      <p><strong>${data.address}${data.postcode ? `, ${data.postcode}` : ""}</strong></p>
      <p>${date}</p>
      <p>If you have any questions, please reply to this email.</p>
    `,
  });
}
