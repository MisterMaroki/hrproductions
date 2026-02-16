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

export const metadata = {
  title: "The Property Room — Property Videography & Photography",
  description:
    "Professional property videography, photography, and drone footage for estate agents. Book online.",
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
      <body>{children}</body>
    </html>
  );
}
