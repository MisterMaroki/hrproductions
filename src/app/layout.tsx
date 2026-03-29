import { Libre_Franklin, DM_Sans } from "next/font/google";
import "./globals.css";

const libreFranklin = Libre_Franklin({
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const viewport = {
  viewportFit: "cover" as const,
};

export const metadata = {
  title:
    process.env.NEXT_PUBLIC_BRAND_MODE === "whitelabel" || process.env.BRAND_MODE === "whitelabel"
      ? "Property Media Bookings"
      : "The Property Room — Property Marketing & Visual Media",
  description:
    "Professional property marketing and visual media for estate agents. Book online.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${libreFranklin.variable} ${dmSans.variable}`}
    >
      <head>
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
      </head>
      <body>{children}</body>
    </html>
  );
}
